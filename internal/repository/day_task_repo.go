package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// DayTaskRepository defines data access methods for day tasks associated with a day session
type DayTaskRepository interface {
	Create(ctx context.Context, userID, date string, dayTask *model.DayTask) error
	GetByID(ctx context.Context, userID, date, dayTaskID string) (*model.DayTask, error)
	FindByID(ctx context.Context, userID, dayTaskID string) (*model.DayTask, string, error)
	ListByDate(ctx context.Context, userID, date string) ([]*model.DayTask, error)
	Update(ctx context.Context, userID, date string, dayTask *model.DayTask) error
	Delete(ctx context.Context, userID, date, dayTaskID string) error
	Reorder(ctx context.Context, userID, date string, orderedDayTaskIDs []string) error
}

type firestoreDayTaskRepository struct {
	client *firestore.Client
}

// NewDayTaskRepository constructs a Firestore-backed DayTaskRepository
func NewDayTaskRepository(client *firestore.Client) DayTaskRepository {
	return &firestoreDayTaskRepository{client: client}
}

func (r *firestoreDayTaskRepository) dayTasksColl(userID, date string) *firestore.CollectionRef {
	return r.client.Collection("users").Doc(userID).Collection("day_sessions").Doc(date).Collection("day_tasks")
}

func (r *firestoreDayTaskRepository) Create(ctx context.Context, userID, date string, dayTask *model.DayTask) error {
	if userID == "" || date == "" || dayTask.TaskID == "" {
		return fmt.Errorf("%w: user_id, date, and task_id are required", model.ErrInvalidInput)
	}

	if dayTask.ID == "" {
		dayTask.ID = uuid.New().String()
	}
	dayTask.DaySessionID = date

	now := time.Now().UTC()
	if dayTask.CreatedAt.IsZero() {
		dayTask.CreatedAt = now
	}
	dayTask.UpdatedAt = now

	docRef := r.dayTasksColl(userID, date).Doc(dayTask.ID)
	if _, err := docRef.Set(ctx, dayTask); err != nil {
		return fmt.Errorf("failed to create day task: %w", err)
	}
	return nil
}

func (r *firestoreDayTaskRepository) GetByID(ctx context.Context, userID, date, dayTaskID string) (*model.DayTask, error) {
	if userID == "" || date == "" || dayTaskID == "" {
		return nil, fmt.Errorf("%w: user_id, date, and day_task_id are required", model.ErrInvalidInput)
	}

	docRef := r.dayTasksColl(userID, date).Doc(dayTaskID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get day task: %w", err)
	}

	var dayTask model.DayTask
	if err := snap.DataTo(&dayTask); err != nil {
		return nil, fmt.Errorf("failed to decode day task: %w", err)
	}
	return &dayTask, nil
}

func (r *firestoreDayTaskRepository) FindByID(ctx context.Context, userID, dayTaskID string) (*model.DayTask, string, error) {
	if userID == "" || dayTaskID == "" {
		return nil, "", fmt.Errorf("%w: user_id and day_task_id are required", model.ErrInvalidInput)
	}

	iter := r.client.CollectionGroup("day_tasks").Where("id", "==", dayTaskID).Documents(ctx)
	snaps, err := iter.GetAll()
	if err != nil {
		return nil, "", fmt.Errorf("failed to query day task by id: %w", err)
	}

	expectedPrefix := fmt.Sprintf("users/%s/", userID)
	for _, snap := range snaps {
		if strings.Contains(snap.Ref.Path, expectedPrefix) {
			var dt model.DayTask
			if err := snap.DataTo(&dt); err != nil {
				return nil, "", fmt.Errorf("failed to decode day task: %w", err)
			}
			date := dt.DaySessionID
			if date == "" && snap.Ref.Parent != nil && snap.Ref.Parent.Parent != nil {
				date = snap.Ref.Parent.Parent.ID
			}
			return &dt, date, nil
		}
	}

	return nil, "", model.ErrNotFound
}

func (r *firestoreDayTaskRepository) ListByDate(ctx context.Context, userID, date string) ([]*model.DayTask, error) {
	if userID == "" || date == "" {
		return nil, fmt.Errorf("%w: user_id and date are required", model.ErrInvalidInput)
	}

	iter := r.dayTasksColl(userID, date).
		OrderBy("priority_order", firestore.Asc).
		Documents(ctx)

	snaps, err := iter.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to list day tasks: %w", err)
	}

	dayTasks := make([]*model.DayTask, 0, len(snaps))
	for _, snap := range snaps {
		var dt model.DayTask
		if err := snap.DataTo(&dt); err != nil {
			return nil, fmt.Errorf("failed to decode day task: %w", err)
		}
		dayTasks = append(dayTasks, &dt)
	}

	return dayTasks, nil
}

func (r *firestoreDayTaskRepository) Update(ctx context.Context, userID, date string, dayTask *model.DayTask) error {
	if userID == "" || date == "" || dayTask.ID == "" {
		return fmt.Errorf("%w: user_id, date, and day_task_id are required", model.ErrInvalidInput)
	}

	docRef := r.dayTasksColl(userID, date).Doc(dayTask.ID)
	dayTask.UpdatedAt = time.Now().UTC()

	// Verify existence
	if _, err := docRef.Get(ctx); err != nil {
		if status.Code(err) == codes.NotFound {
			return model.ErrNotFound
		}
		return fmt.Errorf("failed to verify day task before update: %w", err)
	}

	if _, err := docRef.Set(ctx, dayTask); err != nil {
		return fmt.Errorf("failed to update day task: %w", err)
	}
	return nil
}

func (r *firestoreDayTaskRepository) Delete(ctx context.Context, userID, date, dayTaskID string) error {
	if userID == "" || date == "" || dayTaskID == "" {
		return fmt.Errorf("%w: user_id, date, and day_task_id are required", model.ErrInvalidInput)
	}

	docRef := r.dayTasksColl(userID, date).Doc(dayTaskID)
	if _, err := docRef.Delete(ctx); err != nil {
		return fmt.Errorf("failed to delete day task: %w", err)
	}
	return nil
}

func (r *firestoreDayTaskRepository) Reorder(ctx context.Context, userID, date string, orderedDayTaskIDs []string) error {
	if userID == "" || date == "" {
		return fmt.Errorf("%w: user_id and date are required", model.ErrInvalidInput)
	}
	if len(orderedDayTaskIDs) == 0 {
		return nil
	}

	batch := r.client.Batch()
	now := time.Now().UTC()
	coll := r.dayTasksColl(userID, date)

	for i, id := range orderedDayTaskIDs {
		docRef := coll.Doc(id)
		batch.Update(docRef, []firestore.Update{
			{Path: "priority_order", Value: i + 1},
			{Path: "updated_at", Value: now},
		})
	}

	if _, err := batch.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit day tasks reorder batch: %w", err)
	}
	return nil
}
