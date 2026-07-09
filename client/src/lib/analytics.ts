import ReactGA from 'react-ga4';

const GA_MEASUREMENT_ID = 'G-TNCFL02S7R';

export const initAnalytics = () => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  } else {
    console.warn('Google Analytics Measurement ID is not defined.');
  }
};

export const trackPageView = (path: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.send({ hitType: 'pageview', page: path });
  }
};

export const trackEvent = (category: string, action: string, label?: string, value?: number) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({
      category,
      action,
      label,
      value
    });
  }
};
