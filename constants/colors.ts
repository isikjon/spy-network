export interface Theme {
  background: string;
  primary: string;
  primaryDim: string;
  border: string;
  overlay: string;
  card: string;
  danger: string;
  warning: string;
  success: string;
  text: string;
  textSecondary: string;
}

export const themes = {
  spy: {
    background: '#000000',
    primary: '#00FF41',
    primaryDim: '#00AA2B',
    border: '#003311',
    overlay: 'rgba(0, 255, 65, 0.1)',
    card: '#0A0A0A',
    danger: '#FF0033',
    warning: '#FFAA00',
    success: '#00FF41',
    text: '#00FF41',
    textSecondary: '#00AA2B',
  } as Theme,
  business: {
    background: '#F8F9FA',
    primary: '#2563EB',
    primaryDim: '#60A5FA',
    border: '#E5E7EB',
    overlay: 'rgba(37, 99, 235, 0.05)',
    card: '#FFFFFF',
    danger: '#DC2626',
    warning: '#F59E0B',
    success: '#10B981',
    text: '#1F2937',
    textSecondary: '#6B7280',
  } as Theme,
  genesis: {
    background: '#171717',
    primary: '#FDB458',
    primaryDim: '#FDB458',
    border: '#362E21',
    overlay: 'rgba(253, 180, 88, 0.1)',
    card: '#1F1F1F',
    danger: '#EF4444',
    warning: '#FDB458',
    success: '#10B981',
    text: '#FFFFFF',
    textSecondary: '#D1D5DB',
  } as Theme,
};

export type ThemeType = keyof typeof themes;

export default {
  spy: themes.spy,
  business: themes.business,
  genesis: themes.genesis,
};
