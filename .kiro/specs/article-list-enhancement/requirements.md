# Requirements Document

## Introduction

This feature enhances the article management page by improving the display of article metadata. The enhancements include fixing the creation time display, adding new columns for distillation results and conversion targets, and removing unnecessary columns to streamline the interface.

## Glossary

- **Article Management System**: The system component responsible for displaying and managing articles
- **Distillation Result**: The source material that was used to generate an article through the distillation process
- **Conversion Target**: The intended audience or purpose configuration for an article
- **Creation Time**: The timestamp when an article was first created in the system
- **Database Schema**: The structure of database tables and their relationships

## Requirements

### Requirement 1

**User Story:** As a content manager, I want to see the correct creation time for articles, so that I can accurately track when content was created.

#### Acceptance Criteria

1. WHEN the article list page loads THEN the system SHALL display the creation time in the correct format for each article
2. WHEN articles are sorted by creation time THEN the system SHALL order them based on the actual creation timestamp
3. WHEN the creation time is displayed THEN the system SHALL format it in a human-readable format (YYYY-MM-DD HH:mm:ss)

### Requirement 2

**User Story:** As a content manager, I want to see which distillation result was used for each article, so that I can trace the source material of generated content.

#### Acceptance Criteria

1. WHEN the article list page displays THEN the system SHALL show a "Distillation Result" column after the "Keywords" column
2. WHEN an article has an associated distillation result THEN the system SHALL display the distillation result identifier or title
3. WHEN an article has no associated distillation result THEN the system SHALL display an empty value or placeholder
4. WHEN the database stores article data THEN the system SHALL maintain the relationship between articles and distillation results

### Requirement 3

**User Story:** As a content manager, I want to see the conversion target for each article, so that I can understand the intended audience or purpose of the content.

#### Acceptance Criteria

1. WHEN the article list page displays THEN the system SHALL show a "Conversion Target" column before the "Keywords" column
2. WHEN an article has an associated conversion target THEN the system SHALL display the conversion target name or identifier
3. WHEN an article has no associated conversion target THEN the system SHALL display an empty value or placeholder
4. WHEN the database stores article data THEN the system SHALL maintain the relationship between articles and conversion targets

### Requirement 4

**User Story:** As a content manager, I want a streamlined article list interface, so that I can focus on the most relevant information without visual clutter.

#### Acceptance Criteria

1. WHEN the article list page displays THEN the system SHALL NOT show a "Preview" column
2. WHEN the article list page displays THEN the system SHALL NOT show an "AI Model" column
3. WHEN the UI renders the article list THEN the system SHALL maintain proper column alignment and spacing

### Requirement 5

**User Story:** As a system administrator, I want the database schema to support the new column requirements, so that article metadata is properly stored and retrieved.

#### Acceptance Criteria

1. WHEN the database schema is updated THEN the system SHALL ensure articles table has fields for distillation result references
2. WHEN the database schema is updated THEN the system SHALL ensure articles table has fields for conversion target references
3. WHEN database queries execute THEN the system SHALL efficiently retrieve article data with related distillation results and conversion targets
4. WHEN the database migration runs THEN the system SHALL preserve existing article data without loss
