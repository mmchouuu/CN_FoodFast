import { loadStripe } from '@stripe/stripe-js';

let stripeClientPromise;

export function getStripe() {
  if (!stripeClientPromise) {
    const publishableKey =
      import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_demo_12345';
    stripeClientPromise = loadStripe(publishableKey);
  }
  return stripeClientPromise;
}

