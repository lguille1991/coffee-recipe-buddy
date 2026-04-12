export const SAVED_RECIPE_DETAIL_SELECT = [
  'id',
  'user_id',
  'schema_version',
  'bean_info',
  'method',
  'original_recipe_json',
  'current_recipe_json',
  'feedback_history',
  'image_url',
  'notes',
  'creator:profiles!user_id(display_name)',
  'created_at',
  'archived',
  'live_snapshot_id',
  'parent_recipe_id',
  'scale_factor',
].join(', ')

export const AUTO_ADJUST_SOURCE_SELECT = [
  'id',
  'user_id',
  'method',
  'bean_info',
  'current_recipe_json',
].join(', ')

export const SHARE_SNAPSHOT_SELECT = [
  'bean_info',
  'current_recipe_json',
  'image_url',
  'notes',
].join(', ')
