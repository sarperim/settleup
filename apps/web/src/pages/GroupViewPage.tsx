/**
 * Placeholder page: `/groups/:groupId` — group view with the four §6 tabs
 * (Expenses / Balances / Settle-up / Members; UC-EXP-004, UC-BAL-001/002,
 * UC-GRP-005).
 *
 * Each tab is a labelled placeholder for now; the tab panels are filled by
 * the domain UI tickets.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GROUP_TABS, GROUP_TAB_LABELS, type GroupTab } from '../routes';

const TAB_PLACEHOLDERS: Record<GroupTab, string> = {
  expenses: 'Group ledger placeholder.',
  balances: 'Per-member balances placeholder.',
  'settle-up': 'Settle-up suggestions placeholder.',
  members: 'Member list placeholder.',
};

export function GroupViewPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [activeTab, setActiveTab] = useState<GroupTab>('expenses');

  return (
    <section>
      <h1>Group</h1>
      <p>Group ID: {groupId}</p>
      <nav aria-label="Group sections">
        {GROUP_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => {
              setActiveTab(tab);
            }}
          >
            {GROUP_TAB_LABELS[tab]}
          </button>
        ))}
      </nav>
      <h2>{GROUP_TAB_LABELS[activeTab]}</h2>
      <p>{TAB_PLACEHOLDERS[activeTab]}</p>
    </section>
  );
}
