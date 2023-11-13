document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');

    var form = document.getElementById('custIDForm');
    var loading = document.getElementById('loading');
    var dataOutput = document.getElementById('dataOutput');
    var timerOutput = document.createElement('div');
    timerOutput.id = 'timerOutput';
    form.insertAdjacentElement('afterend', timerOutput); // Place the timer output right after the form

    // Function to update progress with percentage completion
    function updateProgress(percentage, message) {
        dataOutput.innerHTML = `<div style="color: green;">${percentage}% completed:</div> ${message}`;
    }

    // Initialize SSE for progress updates
    var eventSource = new EventSource('/progress');
    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.message) {
            updateProgress(data.percentage, data.message); // Update progress on message received
        }
    };

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var custID = document.getElementById('custIDInput').value;
        dataOutput.innerHTML = ''; // Clear previous data
        loading.style.display = 'inline-block'; // Show loading animation
        timerOutput.textContent = 'Loading...';

        var secondsElapsed = 0;
        var timer = setInterval(function() {
            secondsElapsed++;
            timerOutput.textContent = 'Loading... ' + secondsElapsed + 's';
        }, 1000);

        fetch('/executeScript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custID: custID }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            clearInterval(timer); // Stop the timer
            loading.style.display = 'none'; // Hide loading animation
            const output = data.output ? `<pre>${data.output}</pre>` : "No output returned.";
            const message = data.message ? `<p>${data.message}</p>` : "No message returned.";
                       // Stop the timer and hide the loading animation
            clearInterval(timer);
            loading.style.display = 'none';

            // Display the result and output
            timerOutput.textContent = `Total time elapsed: ${secondsElapsed}s`;
            dataOutput.innerHTML = message + output;

            // If the data contains a percentage, display it
            if (data.percentage) {
                updateProgress(data.percentage, "Operation complete.");
            }
        })
        .catch(error => {
            // If there's an error, stop the timer, hide the loading animation, and reset the form
            clearInterval(timer);
            loading.style.display = 'none';
            timerOutput.textContent = '';
            dataOutput.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
            form.reset();
        });
    });
});


