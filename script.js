// Save status functionality
function showSaveStatus() {
  const status = document.getElementById('saveStatus');
  status.classList.add('show');
  setTimeout(() => {
    status.classList.remove('show');
  }, 2000);
}

// Initialize checkboxes from localStorage after md2html renders
function initializeCheckboxes() {
  // Load saved states
  const saved = JSON.parse(localStorage.getItem('walmartTasks') || '{}');
  
  // Get all checkboxes that were rendered by md2html
  document.querySelectorAll('.markdown-rendered input[type="checkbox"]').forEach((checkbox, index) => {
    // Find the parent list item to get the task text
    const li = checkbox.closest('li');
    if (li) {
      // Get text without the checkbox
      const taskText = li.childNodes[li.childNodes.length - 1]?.textContent?.trim() || `task-${index}`;
      
      // Add data attribute
      checkbox.dataset.task = taskText;
      
      // Set checked state from localStorage
      if (saved[taskText]) {
        checkbox.checked = true;
      }
      
      // Add change listener
      checkbox.addEventListener('change', function() {
        const saved = JSON.parse(localStorage.getItem('walmartTasks') || '{}');
        saved[this.dataset.task] = this.checked;
        localStorage.setItem('walmartTasks', JSON.stringify(saved));
        showSaveStatus();
      });
    }
  });
}

// Wait for md2html to finish rendering
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure md2html has processed
    setTimeout(initializeCheckboxes, 50);
  });
} else {
  setTimeout(initializeCheckboxes, 50);
}
