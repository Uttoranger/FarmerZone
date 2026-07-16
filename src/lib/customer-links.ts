// Externe Links der Kundenansicht (Sprint 20): Anfahrt & Teilen.

export function buildMapsUrl(address: string, postalCode: string, city: string): string {
  const query = `${address}, ${postalCode} ${city}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function buildShareData(farmName: string, url: string): { title: string; text: string; url: string } {
  return {
    title: farmName,
    text: `${farmName} auf FarmerZone — regionale Produkte direkt vom Hof`,
    url,
  }
}
