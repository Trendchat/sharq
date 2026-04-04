function initializeInvoiceCounter(db) {
    db.invoiceCounter = db.invoiceCounter || 0; // If it does not exist, initialize to 0
}

function executeSaleCore(type, ...otherParams) {
    let db = getDatabaseInstance(); // Assuming there's a function to get the database instance
    initializeInvoiceCounter(db);

    let newSale = {
        id: ++db.invoiceCounter, // Use the incrementing invoiceCounter
        invoice_type: type,
        // ... other sale data
    };
    // Save newSale to database or proceed with sale execution
}

function searchInvoicesByNumber(invoiceNumber) {
    let db = getDatabaseInstance();
    return db.invoices.filter(invoice => invoice.id === invoiceNumber);
}

function searchInvoicesByCustomerName(customerName) {
    let db = getDatabaseInstance();
    return db.invoices.filter(invoice => invoice.customerName.toLowerCase() === customerName.toLowerCase());
}

// Assume code for rendering invoices in the reports screen will utilize these search functions.
