// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/react';
import { Sparkline } from './Sparkline';

const meta = {
  title: 'Telemetry/Sparkline',
  component: Sparkline,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AwaitingData: Story = {
  args: {
    data: [],
  },
};

export const NormalMovement: Story = {
  args: {
    data: [180, 175, 170, 150, 120, 90, 80, 75, 80, 90, 110, 140, 170, 180],
    maxAngle: 180,
  },
};

export const DeepSquat: Story = {
  args: {
    data: [180, 170, 140, 90, 60, 50, 60, 90, 150, 180],
    maxAngle: 180,
  },
};
