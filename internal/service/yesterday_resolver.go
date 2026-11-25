package service

import (
	"context"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
)

const yesterdayLookbackLimit = 30

// resolveYesterdayCompletedTasks walks backward through prior day sessions (ordered date DESC)
// and returns the completed tasks from the FIRST prior date that has at least one non-YESTERDAY
// completed DayTask. Legacy StatusYesterday documents are ignored so completed tasks never
// accumulate across multiple days.
func resolveYesterdayCompletedTasks(
	ctx context.Context,
	daySessionRepo repository.DaySessionRepository,
	dayTaskRepo repository.DayTaskRepository,
	taskRepo repository.TaskRepository,
	userID, targetDate string,
) (string, []model.DayTaskWithDetails, error) {
	empty := make([]model.DayTaskWithDetails, 0)

	recentSessions, err := daySessionRepo.ListBeforeDate(ctx, userID, targetDate, yesterdayLookbackLimit)
	if err != nil {
		return "", empty, err
	}

	for _, sess := range recentSessions {
		if sess == nil || sess.Date == "" {
			continue
		}

		dayTasks, listErr := dayTaskRepo.ListByDate(ctx, userID, sess.Date)
		if listErr != nil {
			return "", empty, listErr
		}

		completed := make([]*model.DayTask, 0)
		for _, dt := range dayTasks {
			if dt != nil && dt.IsCompleted && dt.Status != model.StatusYesterday {
				completed = append(completed, dt)
			}
		}

		if len(completed) == 0 {
			continue
		}

		taskIDs := make([]string, 0, len(completed))
		for _, dt := range completed {
			if dt.TaskID != "" {
				taskIDs = append(taskIDs, dt.TaskID)
			}
		}

		tasksMap, fetchErr := taskRepo.GetByIDs(ctx, userID, taskIDs)
		if fetchErr != nil {
			return "", empty, fetchErr
		}
		if tasksMap == nil {
			tasksMap = make(map[string]*model.Task)
		}

		result := make([]model.DayTaskWithDetails, 0, len(completed))
		for _, dt := range completed {
			var title, description string
			if masterTask, ok := tasksMap[dt.TaskID]; ok && masterTask != nil {
				title = masterTask.Title
				description = masterTask.Description
			}

			var blockerPtr *string
			if dt.BlockerReason != "" {
				reason := dt.BlockerReason
				blockerPtr = &reason
			}

			result = append(result, model.DayTaskWithDetails{
				DayTaskID:     dt.ID,
				TaskID:        dt.TaskID,
				Title:         title,
				Description:   description,
				Status:        model.StatusYesterday,
				IsCompleted:   true,
				CompletedAt:   dt.CompletedAt,
				PriorityOrder: dt.PriorityOrder,
				BlockerReason: blockerPtr,
			})
		}

		return sess.Date, result, nil
	}

	return "", empty, nil
}
