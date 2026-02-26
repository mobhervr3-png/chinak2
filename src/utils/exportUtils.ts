/**
 * Utility function to export JSON data to CSV and trigger a download
 */
export const exportToCSV = (data: any[], type: string) => {
  if (!data || data.length === 0) {
    alert('No data available to export');
    return;
  }

  let headers: string[] = [];
  let rows: any[] = [];

  switch (type) {
    case 'products':
      headers = ['ID', 'Name', 'Chinese Name', 'Price (IQD)', 'Price (RMB)', 'Featured', 'Active', 'Created At'];
      rows = data.map(p => [
        p.id,
        p.name,
        p.chineseName || '',
        p.price,
        p.basePriceRMB || '',
        p.isFeatured ? 'Yes' : 'No',
        p.isActive ? 'Yes' : 'No',
        new Date(p.createdAt).toLocaleDateString()
      ]);
      break;
    case 'orders':
      headers = ['Order ID', 'Customer', 'Phone', 'Total', 'Status', 'Items Count', 'Created At'];
      rows = data.map(o => [
        o.id,
        o.user?.name || 'N/A',
        o.user?.phone || 'N/A',
        o.total,
        o.status,
        o.items?.length || 0,
        new Date(o.createdAt).toLocaleDateString()
      ]);
      break;
    case 'users':
      headers = ['User ID', 'Name', 'Phone', 'Role', 'Orders Count', 'Created At'];
      rows = data.map(u => [
        u.id,
        u.name,
        u.phone,
        u.role,
        u._count?.orders || 0,
        new Date(u.createdAt).toLocaleDateString()
      ]);
      break;
    case 'activity':
      headers = ['Admin', 'Action', 'Target', 'Details', 'Date'];
      rows = data.map(log => [
        log.adminName,
        log.action,
        log.targetType,
        log.details,
        new Date(log.createdAt).toLocaleString()
      ]);
      break;
    case 'reviews':
      headers = ['User', 'Product', 'Rating', 'Comment', 'Date'];
      rows = data.map(r => [
        r.user?.name || 'N/A',
        r.product?.name || 'N/A',
        r.rating,
        r.comment,
        new Date(r.createdAt).toLocaleDateString()
      ]);
      break;
    case 'coupons':
      headers = ['Code', 'Type', 'Value', 'Min Order', 'Max Discount', 'Expiry', 'Usage', 'Active'];
      rows = data.map(c => [
        c.code,
        c.discountType,
        c.discountValue,
        c.minOrderAmount,
        c.maxDiscount || 'N/A',
        c.endDate ? new Date(c.endDate).toLocaleDateString() : 'Never',
        `${c.usageCount} / ${c.maxUsage || '∞'}`,
        c.isActive ? 'Yes' : 'No'
      ]);
      break;
    default:
      // Generic export
      headers = Object.keys(data[0]);
      rows = data.map(row => headers.map(header => row[header]));
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map((val: any) => {
      const stringVal = val === null || val === undefined ? '' : String(val);
      return `"${stringVal.replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
