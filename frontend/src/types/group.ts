// ============================================================================
// Group Types (Phase 7: Family Sharing)
// ============================================================================

/**
 * Group - Family group for sharing appliances
 */
export interface Group {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * GroupMember - A member of a group
 */
export interface GroupMember {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  joined_at: string;
}

/**
 * GroupWithMembers - Group with member information
 */
export interface GroupWithMembers extends Group {
  members: GroupMember[];
  member_count: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request to create a new group
 */
export interface GroupCreate {
  name: string;
}

/**
 * Request to update a group
 */
export interface GroupUpdate {
  name: string;
}

/**
 * Request to join a group using invite code
 */
export interface JoinGroupRequest {
  invite_code: string;
}

/**
 * Response from joining a group
 */
export interface JoinGroupResponse {
  success: boolean;
  group: Group | null;
  message: string | null;
}

/**
 * Response containing the invite code
 */
export interface InviteCodeResponse {
  invite_code: string;
}

/**
 * Response listing user's groups
 */
export interface GroupListResponse {
  groups: GroupWithMembers[];
  count: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Standard API error response
 */
export interface GroupErrorResponse {
  error: string;
  code: string;
  details?: string;
}
