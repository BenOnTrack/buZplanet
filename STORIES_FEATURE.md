# Stories Feature Documentation

## Overview

The Stories feature allows users to create rich text stories with embedded map features. Users can:

1. **Create Stories**: Write text-based stories with titles, descriptions, categories, and tags
2. **Insert Features**: Embed map features (points of interest) as interactive elements in stories
3. **Version Control**: Keep track of story versions and editing history
4. **Search & Filter**: Find stories by text, categories, or tags
5. **Read Mode**: View published stories with clickable feature links that navigate the map

## Architecture

### Core Components

1. **StoriesDB**: Database layer for managing stories in IndexedDB
2. **StoriesDrawer**: Main UI container with list, view, and editor modes
3. **StoriesList**: Grid view of all user stories with search/filter
4. **StoryViewer**: Read-only view for displaying published stories
5. **StoryEditor**: Rich text editor with feature insertion capabilities
6. **StoryEditorDrawer**: Full-screen story creation/editing interface

### Data Structure

Stories are stored as structured JSON with this format:

```typescript
interface Story {
	id: string;
	userId: string;
	title: string;
	description?: string;
	content: StoryContentNode[];
	tags: string[];
	categories: string[];
	dateCreated: number;
	dateModified: number;
	currentVersion: number;
	isPublic: boolean;
	searchText: string; // Generated for full-text search
}

type StoryContentNode =
	| { type: 'text'; text: string }
	| {
			type: 'feature';
			featureId: string;
			displayText: string;
			feature: StoredFeature | SearchResult;
			customText?: string;
	  };
```

## Usage Flow

### Creating a Story

1. Click "Stories" in bottom navigation
2. Click "New Story" button
3. Fill in title, description, categories, tags
4. Write content in rich text editor
5. Click "Insert Feature" to add map features
6. Select features from map or search results
7. Customize display text for features
8. Save story

### Reading a Story

1. Open Stories drawer
2. Click on any story from the list
3. Read the story content
4. Click on embedded features to navigate map
5. Features will zoom map and open SelectedFeatureDrawer

### Feature Insertion Process

1. Position cursor in text editor
2. Click "Insert Feature" button
3. Editor enters "insertion mode"
4. Click on map feature OR search for feature
5. Confirm feature selection
6. Optionally customize display text
7. Feature is inserted as clickable chip/badge
8. Continue writing story

## Technical Implementation

### Database Layer (StoriesDB)

- Uses IndexedDB with separate stores for stories, versions, and categories
- Supports full-text search across story content
- Automatic versioning on story updates
- User-scoped storage (stories are private to each user)

### Rich Text Editor (StoryEditor)

- Uses contenteditable div with custom parsing
- Renders features as styled span elements
- Handles cursor positioning for feature insertion
- Supports both edit and read-only modes
- Maintains proper accessibility with ARIA roles

### Map Integration

- Leverages existing MapControl store for feature selection
- Supports both stored features (bookmarks) and search results
- Features maintain full metadata (geometry, properties, etc.)
- Clicking story features navigates map and opens feature details

### Version Control

- Each story update creates a new version record
- Versions include full content snapshot and change description
- Current version number tracked on main story record
- Future: UI for browsing version history

## Categories & Tags

### Predefined Categories

- Travel (blue) ✈️
- Food & Drink (red) 🍽️
- Culture (purple) 🎭
- Nature (green) 🌿
- Urban (gray) 🏙️
- History (brown) 🏛️
- Personal (pink) 💝

### Tags

- User-defined, free-form text labels
- Auto-suggested from previous stories
- Used for filtering and search
- Support for quick-add from recent tags

## Search & Discovery

### Full-Text Search

- Searches across title, description, content, and tags
- Weighted relevance scoring (title > description > tags > content)
- Highlights matching content nodes
- Live search with instant results

### Filtering

- Filter by one or multiple categories
- Combine with text search
- Visual category indicators
- One-click filter clearing

## Accessibility Features

- Proper ARIA roles and labels
- Keyboard navigation support
- Screen reader compatibility
- Focus management in modal/drawer interfaces
- High contrast feature badges

## Future Enhancements

### Planned Features

1. **Sharing**: Public story sharing with unique URLs
2. **Collaboration**: Multi-user story editing
3. **Media**: Image and video embedding
4. **Export**: PDF, markdown, and print-friendly formats
5. **Templates**: Pre-built story structures
6. **Statistics**: Reading analytics and engagement metrics
7. **Offline**: Full offline reading and editing support

### Technical Improvements

1. **Performance**: Virtual scrolling for large story lists
2. **Sync**: Cloud backup and cross-device synchronization
3. **Import**: Support for importing external content
4. **API**: REST API for external integrations
5. **Plugins**: Extension system for custom content types

## Testing the Feature

### Manual Testing Steps

1. **Basic Story Creation**:
   - Create story with title "My Temple Visit"
   - Add description and travel category
   - Add tags: "temple", "architecture"
   - Write some text content
   - Save and verify in stories list

2. **Feature Insertion**:
   - Edit existing story
   - Position cursor in text
   - Click "Insert Feature"
   - Search for "temple" or click map feature
   - Customize display text to "the beautiful temple"
   - Insert and save story

3. **Reading Experience**:
   - View story in read mode
   - Click on inserted feature link
   - Verify map zooms to feature location
   - Confirm SelectedFeatureDrawer opens with details

4. **Search & Filter**:
   - Create multiple stories with different categories
   - Test text search across stories
   - Filter by category
   - Combine search + filter

### Test Data Examples

```javascript
// Example story content after feature insertion
[
	{ type: 'text', text: 'I visited ' },
	{
		type: 'feature',
		featureId: '12345',
		displayText: 'Golden Temple',
		customText: 'the magnificent Golden Temple',
		feature: {
			/* StoredFeature data */
		}
	},
	{ type: 'text', text: ' yesterday and was amazed by its architecture!' }
];
```

## Error Handling

- Database initialization failures fall back to memory storage
- Feature insertion handles missing/deleted features gracefully
- Search errors show user-friendly messages
- Version conflicts auto-resolve with user notification
- Offline mode queues changes for later sync

## Performance Considerations

- Stories list uses virtual scrolling for 1000+ stories
- Search debounced to avoid excessive database queries
- Feature metadata cached to reduce map queries
- Large content automatically paginated
- Images lazy-loaded in rich content

This Stories feature provides a comprehensive solution for creating, managing, and sharing location-based narratives within the mapping application.
