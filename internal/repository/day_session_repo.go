package repository

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/chadzink/dailycheckin/internal/model"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// DaySessionRepository defines data access operations for daily workday sessions
type DaySessionRepository interface {
	GetByDate(ctx context.Context, userID, date string) (*model.DaySession, error)
	GetOrCreateByDate(ctx context.Context, userID, date string) (*model.DaySession, error)
	Update(ctx context.Context, session *model.DaySession) error
	ListByDateRange(ctx context.Context, userID, startDate, endDate string) ([]*model.DaySession, error)
}

type firestoreDaySessionRepository struct {
	client *firestore.Client
}

// NewDaySessionRepository constructs a Firestore-backed DaySessionRepository
func NewDaySessionRepository(client *firestore.Client) DaySessionRepository {
	return &firestoreDaySessionRepository{client: client}
}

func (r *firestoreDaySessionRepository) sessionsColl(userID string) *firestore.CollectionRef {
	return r.client.Collection("users").Doc(userID).Collection("day_sessions")
}

func (r *firestoreDaySessionRepository) GetByDate(ctx context.Context, userID, date string) (*model.DaySession, error) {
	if userID == "" || date == "" {
		return nil, fmt.Errorf("%w: user_id and date are required", model.ErrInvalidInput)
	}

	docRef := r.sessionsColl(userID).Doc(date)
	snap, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get day session: %w", err)
	}

	var session model.DaySession
	if err := snap.DataTo(&session); err != nil {
		return nil, fmt.Errorf("failed to decode day session: %w", err)
	}
	return &session, nil
}

func (r *firestoreDaySessionRepository) GetOrCreateByDate(ctx context.Context, userID, date string) (*model.DaySession, error) {
	if userID == "" || date == "" {
		return nil, fmt.Errorf("%w: user_id and date are required", model.ErrInvalidInput)
	}

	docRef := r.sessionsColl(userID).Doc(date)
	snap, err := docRef.Get(ctx)
	if err == nil {
		var session model.DaySession
		if err := snap.DataTo(&session); err != nil {
			return nil, fmt.Errorf("failed to decode existing day session: %w", err)
		}
		return &session, nil
	}

	if status.Code(err) != codes.NotFound {
		return nil, fmt.Errorf("failed to inspect day session: %w", err)
	}

	// Create new session
	now := time.Now().UTC()
	session := &model.DaySession{
		ID:        date,
		UserID:    userID,
		Date:      date,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if _, err := docRef.Set(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to initialize day session: %w", err)
	}

	return session, nil
}

func (r *firestoreDaySessionRepository) Update(ctx context.Context, session *model.DaySession) error {
	if session.UserID == "" || session.Date == "" {
		return fmt.Errorf("%w: user_id and date are required", model.ErrInvalidInput)
	}

	docRef := r.sessionsColl(session.UserID).Doc(session.Date)
	session.UpdatedAt = time.Now().UTC()

	// Verify existence
	if _, err := docRef.Get(ctx); err != nil {
		if status.Code(err) == codes.NotFound {
			return model.ErrNotFound
		}
		return fmt.Errorf("failed to verify day session before update: %w", err)
	}

	if _, err := docRef.Set(ctx, session); err != nil {
		return fmt.Errorf("failed to update day session: %w", err)
	}
	return nil
}

func (r *firestoreDaySessionRepository) ListByDateRange(ctx context.Context, userID, startDate, endDate string) ([]*model.DaySession, error) {
	if userID == "" || startDate == "" || endDate == "" {
		return nil, fmt.Errorf("%w: user_id, start_date, and end_date are required", model.ErrInvalidInput)
	}

	iter := r.sessionsColl(userID).
		Where("date", ">=", startDate).
		Where("date", "<=", endDate).
		OrderBy("date", firestore.Asc).
		Documents(ctx)

	snaps, err := iter.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to list day sessions by range: %w", err)
	}

	sessions := make([]*model.DaySession, 0, len(snaps))
	for _, snap := range snaps {
		var session model.DaySession
		if err := snap.DataTo(&session); err != nil {
			return nil, fmt.Errorf("failed to decode day session: %w", err)
		}
		sessions = append(sessions, &session)
	}
	return sessions, nil
}
