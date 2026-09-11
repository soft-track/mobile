import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { EstimateSummary, IssueRead, StatusRead } from '@/api/generated/models';
import { KanbanBoard } from '@/board/kanban-board';
import { ThemeProvider } from '@/ui/theme';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function status(id: number, name: string, category: StatusRead['category']): StatusRead {
  return { id, team_id: 1, name, category, position: id, color: '#6342db' };
}

const STATUSES = [
  status(1, 'Todo', 'unstarted'),
  status(2, 'In Progress', 'started'),
  status(3, 'Cancelled', 'cancelled'),
];

function issue(id: number, statusId: number, overrides: Partial<IssueRead> = {}): IssueRead {
  const user = {
    id: 1,
    username: 'demo',
    full_name: 'Demo User',
    avatar_color: '#6342db',
  };
  return {
    id,
    team_id: 1,
    team_key: 'ENG',
    number: id,
    identifier: `ENG-${id}`,
    title: `Issue ${id}`,
    status: STATUSES.find((s) => s.id === statusId)!,
    priority: 'medium',
    blocked_by_count: 0,
    child_count: 0,
    completed_child_count: 0,
    creator: user,
    labels: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as IssueRead;
}

const ESTIMATES = {
  total_points: 5,
  total_issues: 2,
  unestimated_issues: 1,
  by_status: {
    // Keyed by status id as a string, which is what the server sends.
    '1': { points: 5, issue_count: 1, unestimated_count: 1 },
  },
  by_assignee: [],
} as unknown as EstimateSummary;

function renderBoard(issues: IssueRead[]) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider initialPreference="light">
        <KanbanBoard
          statuses={STATUSES}
          issues={issues}
          estimates={ESTIMATES}
          onMove={jest.fn()}
          onCardPress={jest.fn()}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('KanbanBoard', () => {
  it('draws a column per team status', async () => {
    const view = await renderBoard([issue(1, 1), issue(2, 2)]);
    for (const name of ['Todo', 'In Progress', 'Cancelled']) {
      expect(view.getByLabelText(name)).toBeTruthy();
    }
  });

  it('puts each issue in its own column', async () => {
    const view = await renderBoard([issue(1, 1), issue(2, 2)]);
    expect(view.getByLabelText('ENG-1 Issue 1')).toBeTruthy();
    expect(view.getByLabelText('ENG-2 Issue 2')).toBeTruthy();
  });

  it('starts a cancelled column collapsed', async () => {
    // By category, not by name -- a team may well call it "Won't do".
    const view = await renderBoard([issue(1, 1)]);
    expect(view.getByLabelText('Expand Cancelled')).toBeTruthy();
    expect(view.queryByLabelText('Expand Todo')).toBeNull();
  });

  it('shows the point total the server rolled up', async () => {
    const view = await renderBoard([issue(1, 1)]);
    // "+?" because an unsized issue is not worth zero.
    expect(view.getByText(/5 pts/)).toBeTruthy();
  });

  it('marks a blocked card', async () => {
    const view = await renderBoard([issue(1, 1, { blocked_by_count: 2 })]);
    expect(view.getByLabelText('Blocked by 2 issues')).toBeTruthy();
  });
});
