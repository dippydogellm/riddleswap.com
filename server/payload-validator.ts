// XRPL Transaction Payload Validator
// Validates all transaction payloads for correctness

interface TrustSetPayload {
  TransactionType: 'TrustSet';
  LimitAmount: {
    currency: string;
    issuer: string;
    value: string;
  };
  Flags: number;
}

interface PaymentPayload {
  TransactionType: 'Payment';
  Account: string;
  Destination: string;
  Amount: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  SendMax?: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  DeliverMin?: {
    currency: string;
    issuer: string;
    value: string;
  };
  Flags?: number;
  Fee?: string;
  Paths?: any[];
  Memos?: any[];
}

interface SignInPayload {
  TransactionType: 'SignIn';
}

export function validateTrustSetPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (payload.TransactionType !== 'TrustSet') {
    errors.push('Invalid TransactionType for TrustSet');
  }

  if (!payload.LimitAmount) {
    errors.push('Missing LimitAmount');
  } else {
    if (!payload.LimitAmount.currency) {
      errors.push('Missing currency in LimitAmount');
    }
    if (!payload.LimitAmount.issuer) {
      errors.push('Missing issuer in LimitAmount');
    }
    if (!payload.LimitAmount.value) {
      errors.push('Missing value in LimitAmount');
    }
  }

  // Validate flags - should be 131072 (tfSetNoRipple) for proper trustlines
  if (payload.Flags !== 131072) {
    errors.push(`Invalid Flags: ${payload.Flags}, should be 131072 (tfSetNoRipple)`);
  }

  return { valid: errors.length === 0, errors };
}

export function validatePaymentPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (payload.TransactionType !== 'Payment') {
    errors.push('Invalid TransactionType for Payment');
  }

  if (!payload.Account) {
    errors.push('Missing Account');
  }

  if (!payload.Destination) {
    errors.push('Missing Destination');
  }

  if (!payload.Amount) {
    errors.push('Missing Amount');
  } else {
    // Validate Amount format
    if (typeof payload.Amount === 'object') {
      if (!payload.Amount.currency || !payload.Amount.issuer || !payload.Amount.value) {
        errors.push('Invalid Amount object format');
      }
    } else if (typeof payload.Amount !== 'string') {
      errors.push('Amount must be string (XRP drops) or object (IOU)');
    }
  }

  // Validate SendMax if present
  if (payload.SendMax) {
    if (typeof payload.SendMax === 'object') {
      if (!payload.SendMax.currency || !payload.SendMax.issuer || !payload.SendMax.value) {
        errors.push('Invalid SendMax object format');
      }
    } else if (typeof payload.SendMax !== 'string') {
      errors.push('SendMax must be string (XRP drops) or object (IOU)');
    }
  }

  // Validate DeliverMin if present (for partial payments)
  if (payload.DeliverMin) {
    if (typeof payload.DeliverMin === 'object') {
      if (!payload.DeliverMin.currency || !payload.DeliverMin.issuer || !payload.DeliverMin.value) {
        errors.push('Invalid DeliverMin object format');
      }
    } else if (typeof payload.DeliverMin !== 'string') {
      errors.push('DeliverMin must be string (XRP drops) or object (IOU)');
    }
    
    // DeliverMin requires tfPartialPayment flag
    if (payload.Flags !== 131072 && payload.Flags !== 0x00020000) {
      errors.push('DeliverMin requires tfPartialPayment flag (131072)');
    }
  }

  // Validate DeliverMax if present (deprecated, use Amount instead)
  if (payload.DeliverMax) {
    errors.push('DeliverMax is deprecated, use Amount field instead for desired amount');
  }

  // Validate Flags for partial payment
  if (payload.Flags === 131072 || payload.Flags === 0x00020000) {
    // tfPartialPayment flag is set
    if (!payload.DeliverMin && !payload.SendMax) {
      errors.push('Partial payment flag requires DeliverMin and/or SendMax to be set');
    }
  }

  // Validate Fee if present
  if (payload.Fee && typeof payload.Fee !== 'string') {
    errors.push('Fee must be string representation of drops');
  }

  return { valid: errors.length === 0, errors };
}

export function validateSignInPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (payload.TransactionType !== 'SignIn') {
    errors.push('Invalid TransactionType for SignIn');
  }

  return { valid: errors.length === 0, errors };
}

export function validateXummOptions(options: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!options) {
    errors.push('Missing options');
    return { valid: false, errors };
  }

  if (typeof options.submit !== 'boolean') {
    errors.push('submit must be boolean');
  }

  if (typeof options.expire !== 'number' || options.expire < 1 || options.expire > 1440) {
    errors.push('expire must be number between 1 and 1440 minutes');
  }

  // Additional optional fields validation
  if (options.return_url && typeof options.return_url !== 'object') {
    errors.push('return_url must be object if provided');
  }

  if (options.force_network && typeof options.force_network !== 'string') {
    errors.push('force_network must be string if provided');
  }

  return { valid: errors.length === 0, errors };
}

export function logPayloadValidation(payloadType: string, payload: any, options: any) {

  let validation;
  
  switch (payloadType) {
    case 'TrustSet':
      validation = validateTrustSetPayload(payload);
      break;
    case 'Payment':
      validation = validatePaymentPayload(payload);
      break;
    case 'SignIn':
      validation = validateSignInPayload(payload);
      break;
    default:
      validation = { valid: false, errors: ['Unknown payload type'] };
  }
  
  const optionsValidation = validateXummOptions(options);

  if (!validation.valid) {

  }

  if (!optionsValidation.valid) {

  }

  return validation.valid && optionsValidation.valid;
}