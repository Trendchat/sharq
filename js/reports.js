// Function to update the UI and apply filters
function updateUI() {
    // Invoice search functionality
    const invoiceSearchBox = document.createElement('input');
    invoiceSearchBox.placeholder = 'Search by Invoice Number';
    const customerSearchBox = document.createElement('input');
    customerSearchBox.placeholder = 'Search by Customer Name';
    const filterContainer = document.getElementById('filter-container');
    filterContainer.prepend(invoiceSearchBox);
    filterContainer.prepend(customerSearchBox);

    // Default date filter set to the oldest invoice date
    const oldestInvoiceDate = getOldestInvoiceDate();  // Assuming this function exists
    const dateFilter = document.getElementById('date-filter');
    dateFilter.value = oldestInvoiceDate;

    // Event listeners for filtering
    invoiceSearchBox.addEventListener('input', applyFilters);
    customerSearchBox.addEventListener('input', applyFilters);
}

// Function to apply filters to the reports table
function applyFilters() {
    const invoiceFilterValue = invoiceSearchBox.value.toLowerCase();
    const customerFilterValue = customerSearchBox.value.toLowerCase();
    const reportsTable = document.getElementById('reports-table');
    const rows = reportsTable.getElementsByTagName('tr');

    for (let i = 1; i < rows.length; i++) {
        const invoiceCell = rows[i].getElementsByTagName('td')[0]; // Assuming the invoice number is in the first column
        const customerCell = rows[i].getElementsByTagName('td')[1]; // Assuming customer name is in the second column

        const invoiceMatches = invoiceCell.textContent.toLowerCase().includes(invoiceFilterValue);
        const customerMatches = customerCell.textContent.toLowerCase().includes(customerFilterValue);

        rows[i].style.display = (invoiceMatches && customerMatches) ? '' : 'none';
    }
}

// Updated reportFilterModal to show the oldest invoice date by default
function showReportFilterModal() {
    const oldestInvoiceDate = getOldestInvoiceDate(); // Function to be defined to fetch the date
    const dateInput = document.getElementById('filter-date'); // Assuming there's an input for filter date
    dateInput.value = oldestInvoiceDate;
    // Show modal logic...
}
