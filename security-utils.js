/**
 * Security utilities for XSS prevention.
 * Use escapeHtml() on any user-controlled value before inserting into innerHTML.
 */
function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
