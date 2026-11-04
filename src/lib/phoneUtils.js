export function normalizePhoneNumber(raw, defaultCountryCode = "+91") {
  if (!raw) return ""
  const trimmed = raw.trim()
  if (trimmed.startsWith("+")) {
    const digitsOnly = trimmed.slice(1).replace(/\D/g, "")
    return `+${digitsOnly}`
  }
  const digitsOnly = trimmed.replace(/\D/g, "")
  if (digitsOnly.length === 10) {
    return `${defaultCountryCode}${digitsOnly}`
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return `${defaultCountryCode}${digitsOnly.slice(1)}`
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return `+${digitsOnly}`
  }
  if (digitsOnly.length >= 7) {
    return `${defaultCountryCode}${digitsOnly}`
  }
  return trimmed
}

export function isValidPhoneNumber(phone) {
  if (!phone) return false
  const normalized = normalizePhoneNumber(phone)
  return /^\+[1-9]\d{7,14}$/.test(normalized)
}

export function formatIndianDisplay(phone) {
  if (!phone) return ""
  const normalized = normalizePhoneNumber(phone)
  if (normalized.startsWith("+91") && normalized.length === 13) {
    const main = normalized.slice(3)
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`
  }
  return normalized
}
