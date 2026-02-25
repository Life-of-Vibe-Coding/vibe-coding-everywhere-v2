import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@/components/settings/SkillDetailSheet', () => ({
  SkillDetailSheet: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ui/modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Modal: ({ isOpen, children }: { isOpen?: boolean; children: React.ReactNode }) =>
      isOpen ? <View>{children}</View> : null,
  };
});

jest.mock('@/components/icons/ChatActionIcons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = () => <View />;
  return {
    CloseIcon: Icon,
    ChevronRightIcon: Icon,
  };
});

import { SkillConfigurationModal } from '@/components/settings/SkillConfigurationModal';

describe('settings/SkillConfigurationModal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads skills asynchronously when opened', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockImplementation(async (...args: unknown[]) => {
      const url = String(args[0] ?? '');
      if (url.endsWith('/api/skills')) {
        return {
          ok: true,
          json: async () => ({
            skills: [
              {
                id: 'skill-a',
                name: 'Skill A',
                description: 'First skill',
              },
            ],
          }),
        } as any;
      }

      if (url.endsWith('/api/skills-enabled')) {
        return {
          ok: true,
          json: async () => ({ enabledIds: [] }),
        } as any;
      }

      return {
        ok: true,
        json: async () => ({ enabledIds: [] }),
      } as any;
    });

    const { getByText } = render(
      <SkillConfigurationModal
        isOpen
        onClose={jest.fn()}
        serverBaseUrl="http://localhost:3456"
      />
    );

    await waitFor(() => {
      expect(getByText('Skill A')).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalled();
  });
});
