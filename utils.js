// --- دوال تنسيق الأرقام والتواريخ ---
const formatNum = (num) => {
    let n = parseFloat(num);
    return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
};

const displayNum = (num) => {
    let n = parseFloat(num);
    return isNaN(n) ? "0" : n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatDateTime = (isoString) => {
    if (!isoString) return "";
    let d = new Date(isoString);
    let datePart = d.toLocaleDateString('en-GB', { 
        year: 'numeric', month: '2-digit', day: '2-digit' 
    }).split('/').reverse().join('/'); 
    let hours = d.getHours();
    let minutes = d.getMinutes();
    let ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${datePart} | ${hours}:${minutes} ${ampm}`;
};