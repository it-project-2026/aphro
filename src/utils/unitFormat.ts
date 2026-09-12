/**
 * Helper to dynamically format unit title text (e.g., resolving UL BUKITTINGGI based on active settings or storage)
 */
export function formatUnitTitle(text: string, namaUnitLayanan?: string): string {
  if (!text) return '';
  const currentUnit = namaUnitLayanan || localStorage.getItem('aphro_nama_unit_layanan') || 'UL BUKITTINGGI';
  return text.replace(/UP3\s+Padang/gi, currentUnit);
}

export function getFormattedUnitDisplay(namaUnitLayanan?: string): string {
  const activeName = namaUnitLayanan || localStorage.getItem('aphro_nama_unit_layanan') || 'UL BUKITTINGGI';
  return activeName;
}
