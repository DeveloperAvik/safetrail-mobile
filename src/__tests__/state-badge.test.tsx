import { render, screen } from '@testing-library/react-native';
import { StateBadge } from '@/components/state-badge';

describe('StateBadge', () => {
  it('renders an accessible label for each safety state', async () => {
    await render(<StateBadge state="POTENTIAL_INCIDENT" />);
    expect(screen.getByText('Possible incident')).toBeTruthy();
    expect(screen.getByLabelText('Safety state: Possible incident')).toBeTruthy();
  });
});
