/**
 * Platform-Specific Template Syntax
 * Defines variable syntax for different email marketing platforms
 * Ported from ottomate
 */

export interface PlatformDefinition {
  id: string;
  name: string;
  syntax: {
    firstName: string;
    lastName?: string;
    email: string;
    customField: (fieldName: string) => string;
    conditional: {
      if: string;
      else: string;
      endif: string;
    };
    unsubscribe: string;
  };
  supportsHTML: boolean;
}

export const PLATFORMS: Record<string, PlatformDefinition> = {
  klaviyo: {
    id: "klaviyo",
    name: "Klaviyo",
    syntax: {
      firstName: "{{ person.first_name|default:'there' }}",
      lastName: "{{ person.last_name }}",
      email: "{{ person.email }}",
      customField: (fieldName: string) => `{{ person.${fieldName} }}`,
      conditional: {
        if: "{% if person.first_name %}",
        else: "{% else %}",
        endif: "{% endif %}",
      },
      unsubscribe: "{% unsubscribe_link %}",
    },
    supportsHTML: true,
  },
  mailchimp: {
    id: "mailchimp",
    name: "Mailchimp",
    syntax: {
      firstName: "*|FNAME|*",
      lastName: "*|LNAME|*",
      email: "*|EMAIL|*",
      customField: (fieldName: string) => `*|${fieldName.toUpperCase()}|*`,
      conditional: {
        if: "*|IF:FNAME|*",
        else: "*|ELSE:|*",
        endif: "*|END:IF|*",
      },
      unsubscribe: "*|UNSUB|*",
    },
    supportsHTML: true,
  },
  customerio: {
    id: "customerio",
    name: "Customer.io",
    syntax: {
      firstName: "{{customer.first_name | default: 'there'}}",
      lastName: "{{customer.last_name}}",
      email: "{{customer.email}}",
      customField: (fieldName: string) => `{{customer.${fieldName}}}`,
      conditional: {
        if: "{% if customer.first_name %}",
        else: "{% else %}",
        endif: "{% endif %}",
      },
      unsubscribe: "{{unsubscribe_url}}",
    },
    supportsHTML: true,
  },
  activecampaign: {
    id: "activecampaign",
    name: "ActiveCampaign",
    syntax: {
      firstName: "%FIRSTNAME%",
      lastName: "%LASTNAME%",
      email: "%EMAIL%",
      customField: (fieldName: string) => `%${fieldName.toUpperCase()}%`,
      conditional: {
        if: "{{#if ~FIRSTNAME~ }}",
        else: "{{#else}}",
        endif: "{{/if}}",
      },
      unsubscribe: "%UNSUBSCRIBELINK%",
    },
    supportsHTML: true,
  },
  omnisend: {
    id: "omnisend",
    name: "Omnisend",
    syntax: {
      firstName: "[[contact.firstName]]",
      lastName: "[[contact.lastName]]",
      email: "[[contact.email]]",
      customField: (fieldName: string) => `[[contact.${fieldName}]]`,
      conditional: {
        if: "[[#if contact.firstName]]",
        else: "[[else]]",
        endif: "[[/if]]",
      },
      unsubscribe: "[[unsubscribe]]",
    },
    supportsHTML: true,
  },
};

/**
 * Get platform-specific syntax instructions for Claude prompt
 */
export function getSyntaxInstructions(platformId: string): string {
  const platform = PLATFORMS[platformId] || PLATFORMS.klaviyo;

  return `
**Platform:** ${platform.name}

**Required Personalization Syntax:**
- First Name: ${platform.syntax.firstName}
- Email: ${platform.syntax.email}
${platform.syntax.lastName ? `- Last Name: ${platform.syntax.lastName}` : ""}

**Conditional Logic:**
${platform.syntax.conditional.if}
  Content when condition is true
${platform.syntax.conditional.else}
  Fallback content
${platform.syntax.conditional.endif}

**Unsubscribe Link:** ${platform.syntax.unsubscribe}

IMPORTANT:
- Use EXACTLY this syntax for personalization
- Always include unsubscribe link in footer
- Use first name conditional to show "Hi [Name]" or fallback to "Hi there"
`;
}

/**
 * Get list of available platforms
 */
export function getAvailablePlatforms(): PlatformDefinition[] {
  return Object.values(PLATFORMS);
}

/**
 * Get platform by ID
 */
export function getPlatform(platformId: string): PlatformDefinition {
  return PLATFORMS[platformId] || PLATFORMS.klaviyo;
}
