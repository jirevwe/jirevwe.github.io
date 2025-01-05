---
title: Partition Management using go_partman
date: 2025-01-02 11:24:16
tags:
  - tech
  - convoy
  - guide
---

[go_partman](https://github.com/jirevwe/go_partman) is a Go native implementation of PostgreSQL table partitioning management, inspired by [pg_partman](https://github.com/pgpartman/pg_partman). It automatically manages and maintains partitioned tables in PostgreSQL databases by providing the following features:
- Pre-creation of future partitions
- Support for time-based range partitioning
- Configurable tenant-specific retention policies
- Automatic cleanup of old partitions


## Installation and Usage
To get started, we first need to install it

```bash
go get github.com/jirevwe/go_partman
```

### Table Requirements

Your Postgres tables must be created as a partitioned table before using go_partman. Examples:

```sql
-- Single-tenant table
CREATE TABLE events (
    id VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data JSONB,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Multi-tenant table
CREATE TABLE events (
    id VARCHAR NOT NULL,
    project_id VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data JSONB,
    PRIMARY KEY (id, created_at, project_id)
) PARTITION BY RANGE (project_id, created_at);
```

### Sample code

```go
package main

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/jirevwe/go_partman"
	"github.com/jmoiron/sqlx"
	"time"
)

func main() {
	logger := partman.NewSlogLogger()
	
	pgxCfg, err := pgxpool.ParseConfig("postgres://postgres:postgres@localhost:5432/test?sslmode=disable")
	if err != nil {
		logger.Fatal(err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), pgxCfg)
	if err != nil {
		logger.Fatal(err)
	}

	sqlDB := stdlib.OpenDBFromPool(pool)
	db := sqlx.NewDb(sqlDB, "pgx")

	r, err := NewRetentionPolicy(db, logger, time.Minute)
	if err != nil {
		logger.Fatal(err)
	}

	r.Start(context.Background(), time.Minute)
	
	// start your server
	time.Sleep(30 * time.Second)
}

type Retentioner interface {
	Perform(context.Context) error
	Start(context.Context, time.Duration)
}

type RetentionPolicy struct {
	retentionPeriod time.Duration
	partitioner     partman.Partitioner
	logger          *partman.SlogLogger
	db              *sqlx.DB
}

func NewRetentionPolicy(db *sqlx.DB, logger *partman.SlogLogger, period time.Duration) (*RetentionPolicy, error) {
	pm, err := partman.NewManager(
		partman.WithDB(db),
		partman.WithLogger(logger),
		partman.WithConfig(&partman.Config{SampleRate: time.Second}),
		partman.WithClock(partman.NewRealClock()),
	)
	if err != nil {
		return nil, err
	}

	return &RetentionPolicy{
		retentionPeriod: period,
		partitioner:     pm,
		logger:          logger,
		db:              db,
	}, nil
}

func (r *RetentionPolicy) Start(ctx context.Context, sampleRate time.Duration) {
	go func(r *RetentionPolicy) {
		ticker := time.NewTicker(sampleRate)
		defer ticker.Stop()

		// fetch existing partitions on startup,
		// this is useful for one time setups,
		// but I'll leave it in since it'll no-op after the first time
		err := r.partitioner.ImportExistingPartitions(ctx, partman.Table{
			Schema:            "convoy",
			TenantIdColumn:    "project_id",
			PartitionBy:       "created_at",
			PartitionType:     partman.TypeRange,
			RetentionPeriod:   r.retentionPeriod,
			PartitionInterval: time.Hour * 24,
			PartitionCount:    10,
		})
		if err != nil {
			r.logger.Errorf("failed to import existing partitions: %v", err)
		}

		projectRepo := postgres.NewProjectRepo(r.db)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// watches for newly added tables and automatically adds them
				projects, pErr := projectRepo.LoadProjects(context.Background())
				if pErr != nil {
					r.logger.WithError(pErr).Error("failed to load projects")
				}

				for _, project := range projects {
					err = r.partitioner.AddManagedTable(partman.Table{
						Name:              "events",
						Schema:            "convoy",
						TenantId:          project.UID,
						TenantIdColumn:    "project_id",
						PartitionBy:       "created_at",
						PartitionType:     partman.TypeRange,
						RetentionPeriod:   r.retentionPeriod,
						PartitionInterval: time.Hour * 24,
						PartitionCount:    10,
					})
					if err != nil {
						r.logger.WithError(err).Error("failed to add convoy.events to managed tables")
					}

					err = r.partitioner.AddManagedTable(partman.Table{
						Name:              "event_deliveries",
						Schema:            "convoy",
						TenantId:          project.UID,
						TenantIdColumn:    "project_id",
						PartitionBy:       "created_at",
						PartitionType:     partman.TypeRange,
						RetentionPeriod:   r.retentionPeriod,
						PartitionInterval: time.Hour * 24,
						PartitionCount:    10,
					})
					if err != nil {
						r.logger.WithError(err).Error("failed to add convoy.event_deliveries to managed tables")
					}

					err = r.partitioner.AddManagedTable(partman.Table{
						Name:              "delivery_attempts",
						Schema:            "convoy",
						TenantId:          project.UID,
						TenantIdColumn:    "project_id",
						PartitionBy:       "created_at",
						PartitionType:     partman.TypeRange,
						RetentionPeriod:   r.retentionPeriod,
						PartitionInterval: time.Hour * 24,
						PartitionCount:    10,
					})
					if err != nil {
						r.logger.WithError(err).Error("failed to add convoy.delivery_attempts to managed tables")
					}
				}
			}
		}
	}(r)
}

func (r *RetentionPolicy) Perform(ctx context.Context) error {
	return r.partitioner.Maintain(ctx)
}
```


