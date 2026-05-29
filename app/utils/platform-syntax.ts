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
  ghl: {
    id: "ghl",
    name: "GoHighLevel",
    syntax: {
      // GHL: double-curly, lowercase, fallback via `|| "fallback"`. Merge fields
      // fail silently if syntax is off, so always emit a fallback on contact fields.
      firstName: '{{contact.first_name || "there"}}',
      lastName: '{{contact.last_name || ""}}',
      email: "{{contact.email}}",
      customField: (fieldName: string) => `{{contact.custom.${fieldName}}}`,
      conditional: {
        // GHL email accepts Liquid; SMS does not. Per the ghl-merge-field-generator
        // skill, prefer the `||` fallback inline rather than `{% if %}` blocks.
        if: "{% if contact.first_name %}",
        else: "{% else %}",
        endif: "{% endif %}",
      },
      // VERIFY: GHL's built-in unsubscribe variable in V2 email templates.
      // If a custom unsubscribe link is needed, switch to a Custom Value:
      // {{custom_values.unsubscribe_url}}.
      unsubscribe: "{{message.unsubscribe_url}}",
    },
    supportsHTML: true,
  },
};

/**
 * Get platform-specific syntax instructions for Claude prompt
 */
export function getSyntaxInstructions(platformId: string): string {
  const platform = PLATFORMS[platformId] || PLATFORMS.klaviyo;

  // GHL does NOT evaluate Liquid block tags ({% if %}/{% else %}/{% endif %}) —
  // they ship as literal text in the recipient's inbox. So GHL gets its own
  // instruction set with NO conditional block and inline `||` fallbacks only.
  // See .claude/skills/ghl-merge-field-generator.
  if (platformId === "ghl") {
    return `
**Platform:** ${platform.name}

**Required Personalization Syntax:**
- First Name: ${platform.syntax.firstName}
- Email: ${platform.syntax.email}
${platform.syntax.lastName ? `- Last Name: ${platform.syntax.lastName}` : ""}

**GHL MERGE-FIELD RULES (critical, applies to every dynamic field in this email):**

1. Double curly braces, lowercase, underscores not spaces: \`{{contact.first_name}}\`.
2. **Always emit a fallback** on any personalization field using the double-pipe operator: \`{{contact.first_name || "there"}}\`. Blank-name sends are the #1 failure mode in GHL. No exceptions.
3. **NEVER use \`{% if %}\`, \`{% else %}\`, \`{% endif %}\`, or any \`{% ... %}\` tag.** GHL does not evaluate them — they would appear as literal text in the email. There is NO conditional-block syntax. For a personalized greeting, write it inline with the fallback: \`Hi {{contact.first_name || "there"}},\` — never wrap it in a conditional.
4. Use **Custom Values** for stable business data (company name, booking URL, office phone, standard offer name): \`{{custom_values.booking_url}}\`, \`{{custom_values.company_name}}\`. Never hardcode a phone number, booking link, or company name into copy. Invent custom_values keys as needed based on what the copy requires.
5. Use **Custom Fields** only for genuinely per-contact data: \`{{contact.custom.field_key}}\`.
6. **No em dashes** anywhere in subject, preheader, or body. Use a comma, a period, or a rewrite. This is brand voice, not optional.

**Unsubscribe Link:** ${platform.syntax.unsubscribe} (include in the footer)

Self-check before output:
- Every personalization field has a \`||\` fallback?
- ZERO \`{% %}\` tags anywhere in subject, preheader, or body?
- All field paths lowercase and underscore-style?
- Stable business data expressed as \`{{custom_values.*}}\`, not hardcoded?
- Zero em dashes?
`;
  }

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
