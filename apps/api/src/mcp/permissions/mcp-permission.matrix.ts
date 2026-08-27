import { AgentRole } from '@ironloom/shared';

/**
 * Scoped MCP Tool Permissions per Agent Role.
 * Defines strictly which tools an agent role is authorized to invoke.
 */
export const MCP_ROLE_PERMISSIONS: Record<AgentRole, string[]> = {
  business_analyst: [
    'figma_get_file',
    'figma_get_comments',
    'figma_get_component_styles',
    'slack_post_message',
    'slack_post_notification',
    'jira_search_issues',
  ],
  product_manager: [
    'jira_create_epic',
    'jira_create_issue',
    'jira_update_issue_status',
    'jira_search_issues',
    'slack_post_message',
    'slack_post_notification',
    'slack_post_approval_card',
    'figma_get_file',
    'github_get_repo',
    'github_list_issues',
  ],
  requirements_engineer: [
    'jira_create_issue',
    'jira_search_issues',
    'figma_get_file',
    'figma_get_comments',
    'slack_post_notification',
  ],
  architect: [
    'github_get_repo',
    'github_list_issues',
    'github_create_issue',
    'jira_create_epic',
    'jira_search_issues',
    'figma_get_file',
    'figma_get_component_styles',
    'slack_post_notification',
    'slack_post_approval_card',
  ],
  developer: [
    'github_get_repo',
    'github_list_issues',
    'github_create_issue',
    'github_create_pull_request',
    'github_post_comment',
    'jira_update_issue_status',
    'jira_search_issues',
    'slack_post_notification',
  ],
  code_reviewer: [
    'github_get_repo',
    'github_list_issues',
    'github_post_comment',
    'slack_post_notification',
  ],
  qa: [
    'github_get_repo',
    'github_list_issues',
    'github_create_issue',
    'github_post_comment',
    'jira_create_issue',
    'jira_update_issue_status',
    'jira_search_issues',
    'slack_post_notification',
  ],
  devops: [
    'github_get_repo',
    'github_list_issues',
    'slack_post_notification',
    'slack_post_message',
  ],
  monitoring: ['slack_post_notification', 'slack_post_message', 'jira_create_issue'],
  system: [
    'github_get_repo',
    'github_list_issues',
    'github_create_issue',
    'github_create_pull_request',
    'github_post_comment',
    'jira_create_issue',
    'jira_create_epic',
    'jira_update_issue_status',
    'jira_search_issues',
    'figma_get_file',
    'figma_get_comments',
    'figma_get_component_styles',
    'slack_post_message',
    'slack_post_notification',
    'slack_post_approval_card',
  ],
};

export function isToolAllowedForRole(role: AgentRole, toolName: string): boolean {
  const allowed = MCP_ROLE_PERMISSIONS[role];
  if (!allowed) {
    return false;
  }
  return allowed.includes(toolName);
}
