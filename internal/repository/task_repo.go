package repository

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// TaskRepository defines data access methods for master tasks
type TaskRepository interface {
	Create(ctx context.Context, task *model.Task) error
	GetByID(ctx context.Context, userID, taskID string) (*model.Task, error)
	GetByIDs(ctx context.Context, userID string, taskIDs []string) (map[string]*model.Task, error)
	ListBacklog(ctx context.Context, userID string) ([]*model.Task, error)
	Update(ctx context.Context, task *model.Task) error
	Archive(ctx context.Context, userID, taskID string) error
	ReorderBacklog(ctx context.Context, userID string, orderedTaskIDs []string) error
}

type firestoreTaskRepository struct {
	client *firestore.Client
}

// NewTaskRepository constructs a Firestore-backed TaskRepository
func NewTaskRepository(client *firestore.Client) TaskRepository {
	return &firestoreTaskRepository{client: client}
}

func (r *firestoreTaskRepository) userTasksColl(userID string) *firestore.CollectionRef {
	return r.client.Collection("users").Doc(userID).Collection("tasks")
}

func (r *firestoreTaskRepository) Create(ctx context.Context, task *model.Task) error {
	if task.UserID == "" {
		return fmt.Errorf("%w: user_id is required", model.ErrInvalidInput)
	}
	if task.ID == "" {
		task.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if task.CreatedAt.IsZero() {
		task.CreatedAt = now
	}
	task.UpdatedAt = now

	docRef := r.userTasksColl(task.UserID).Doc(task.ID)
	_, err := docRef.Set(ctx, task)
	if err != nil {
		return fmt.Errorf("failed to create task: %w", err)
	}
	return nil
}

func (r *firestoreTaskRepository) GetByID(ctx context.Context, userID, taskID string) (*model.Task, error) {
	if userID == "" || taskID == "" {
		return nil, fmt.Errorf("%w: user_id and task_id are required", model.ErrInvalidInput)
	}

	docRef := r.userTasksColl(userID).Doc(taskID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	var task model.Task
	if err := snap.DataTo(&task); err != nil {
		return nil, fmt.Errorf("failed to decode task data: %w", err)
	}
	return &task, nil
}

// GetByIDs performs a single batched document lookup to retrieve tasks in one round trip, avoiding N+1 queries.
func (r *firestoreTaskRepository) GetByIDs(ctx context.Context, userID string, taskIDs []string) (map[string]*model.Task, error) {
	result := make(map[string]*model.Task)
	if userID == "" || len(taskIDs) == 0 {
		return result, nil
	}

	// Deduplicate IDs
	uniqueIDs := make([]string, 0, len(taskIDs))
	seen := make(map[string]bool)
	for _, id := range taskIDs {
		if id != "" && !seen[id] {
			seen[id] = true
			uniqueIDs = append(uniqueIDs, id)
		}
	}

	if len(uniqueIDs) == 0 {
		return result, nil
	}

	// Prepare document references
	coll := r.userTasksColl(userID)
	docRefs := make([]*firestore.DocumentRef, len(uniqueIDs))
	for i, id := range uniqueIDs {
		docRefs[i] = coll.Doc(id)
	}

	// Batch get all documents in a single round-trip
	snaps, err := r.client.GetAll(ctx, docRefs)
	if err != nil {
		return nil, fmt.Errorf("failed to batch get tasks: %w", err)
	}

	for _, snap := range snaps {
		if snap.Exists() {
			var task model.Task
			if err := snap.DataTo(&task); err == nil {
				result[task.ID] = &task
			}
		}
	}

	return result, nil
}

func (r *firestoreTaskRepository) ListBacklog(ctx context.Context, userID string) ([]*model.Task, error) {
	if userID == "" {
		return nil, fmt.Errorf("%w: user_id is required", model.ErrInvalidInput)
	}

	iter := r.userTasksColl(userID).
		Where("is_archived", "==", false).
		OrderBy("backlog_order", firestore.Asc).
		Documents(ctx)

	snaps, err := iter.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to list backlog tasks: %w", err)
	}

	tasks := make([]*model.Task, 0, len(snaps))
	for _, snap := range snaps {
		var task model.Task
		if err := snap.DataTo(&task); err != nil {
			return nil, fmt.Errorf("failed to decode task: %w", err)
		}
		tasks = append(tasks, &task)
	}

	return tasks, nil
}

func (r *firestoreTaskRepository) Update(ctx context.Context, task *model.Task) error {
	if task.UserID == "" || task.ID == "" {
		return fmt.Errorf("%w: user_id and id are required", model.ErrInvalidInput)
	}

	task.UpdatedAt = time.Now().UTC()
	docRef := r.userTasksColl(task.UserID).Doc(task.ID)

	// Verify existence
	if _, err := docRef.Get(ctx); err != nil {
		if status.Code(err) == codes.NotFound {
			return model.ErrNotFound
		}
		return fmt.Errorf("failed to verify task before update: %w", err)
	}

	if _, err := docRef.Set(ctx, task); err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}
	return nil
}

func (r *firestoreTaskRepository) Archive(ctx context.Context, userID, taskID string) error {
	if userID == "" || taskID == "" {
		return fmt.Errorf("%w: user_id and task_id are required", model.ErrInvalidInput)
	}

	docRef := r.userTasksColl(userID).Doc(taskID)
	now := time.Now().UTC()

	_, err := docRef.Update(ctx, []firestore.Update{
		{Path: "is_archived", Value: true},
		{Path: "updated_at", Value: now},
	})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return model.ErrNotFound
		}
		return fmt.Errorf("failed to archive task: %w", err)
	}
	return nil
}

func (r *firestoreTaskRepository) ReorderBacklog(ctx context.Context, userID string, orderedTaskIDs []string) error {
	if userID == "" {
		return fmt.Errorf("%w: user_id is required", model.ErrInvalidInput)
	}
	if len(orderedTaskIDs) == 0 {
		return nil
	}

	batch := r.client.Batch()
	now := time.Now().UTC()
	coll := r.userTasksColl(userID)

	for i, taskID := range orderedTaskIDs {
		docRef := coll.Doc(taskID)
		batch.Update(docRef, []firestore.Update{
			{Path: "backlog_order", Value: i + 1},
			{Path: "updated_at", Value: now},
		})
	}

	if _, err := batch.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit backlog reorder batch: %w", err)
	}
	return nil
}
