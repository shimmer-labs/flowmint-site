/**
 * GA4 Analytics for FlowMint
 * Fires custom events via gtag (installed in layout.tsx)
 */

declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

function gtagEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}

export const analytics = {
  signUp: (method: string = 'email') => {
    gtagEvent('sign_up', { method })
  },

  login: (method: string = 'email') => {
    gtagEvent('login', { method })
  },

  beginCheckout: (planId: string, value: number) => {
    gtagEvent('begin_checkout', {
      currency: 'USD',
      value,
      items: [{ item_name: `FlowMint ${planId}`, price: value }],
    })
  },

  purchase: (planId: string, value: number, transactionId: string) => {
    gtagEvent('purchase', {
      currency: 'USD',
      value,
      transaction_id: transactionId,
      items: [{ item_name: `FlowMint ${planId}`, price: value }],
    })
  },

  generateAnalysis: (url: string) => {
    gtagEvent('generate_content', { content_type: 'brand_analysis', url })
  },

  generateFlow: (flowType: string) => {
    gtagEvent('generate_content', { content_type: 'email_flow', flow_type: flowType })
  },

  exportContent: (format: string) => {
    gtagEvent('export', { format })
  },

  ctaClicked: (location: string, text: string) => {
    gtagEvent('cta_clicked', { location, cta_text: text })
  },
}
