const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const fs1 = require('fs').promises;
const path = require('path');
const pdf = require('html-pdf');
const puppeteer = require('puppeteer');
const Address = process.argv[5];
//const Address = '146-27 223rd St';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
//const SERVICE_ACCOUNT_PATH = path.join(__dirname, './servicekey.json'); // Replace with the path to your service account key file.
const serviceAccount = JSON.parse(process.env.SERVICE_KEY);
const Name = process.argv[3];
//const Name = 'thomas';
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function authorize() {
    try {
        const jwtClient = new JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: SCOPES,
            subject: 'teamdesign@patriotenergysolution.com', // user to impersonate
        });

        await jwtClient.authorize();
        return jwtClient;
    } catch (error) {
        console.error('Error loading service account from environment variable:', error);
        throw error;
    }
}

function normalizeAddress(address) {
    let normalized = address.toLowerCase();

    // Replace numerals separated by dashes
    normalized = normalized.replace(/-/g, '');

    // Replace specific words with their full version
    normalized = normalized.replace(/\bpl\b/g, 'place');
    normalized = normalized.replace(/\brd\b/g, 'road');
    normalized = normalized.replace(/\bave\b/g, 'avenue');

    return normalized;
}

async function listMessages(auth, Address, Name) {
    const gmail = google.gmail({ version: 'v1', auth });

    // Broad search query
    //const query = `from:(CPMS.noreply@coned.com) to:(teamdesign@patriotenergysolution.com) subject:(Final acceptance letter)`;
    const query = `to:(teamdesign@patriotenergysolution.com) subject:(Final acceptance letter)`;


    const normalizedAddress = normalizeAddress(Address);

 //console.log("Normalized Address:", normalizedAddress);

    try {
        const res = await gmail.users.messages.list({
            userId: 'teamdesign@patriotenergysolution.com',
            q: query,
        });
      //console.log("Response from Gmail API:", res);
        if (res.data.messages && res.data.messages.length > 0) {
            //console.log(`Found ${res.data.messages.length} message(s).`);

            // Loop through each message and handle them one by one
            for (const messageData of res.data.messages) {
                const messageId = messageData.id;
                const message = await gmail.users.messages.get({ userId: 'me', id: messageId });

                let subject = '';
                let snippet = message.data.snippet || '';

                if (message.data.payload.headers) {
                    const subjectHeader = message.data.payload.headers.find(header => header.name === 'Subject');
                    if (subjectHeader) {
                        subject = subjectHeader.value;
                    }
                }

        if (normalizeAddress(subject).includes(normalizedAddress)) {
            // Now, call handleSingleMessage with subject and snippet as parameters.
            const result = await handleMessage(auth, messageId, subject, snippet, Name);
            console.log(JSON.stringify(result));  // Print the result as JSON string
        }
            }
        } else {
            console.log('No new messages.');
        }
    } catch (error) {
        console.log('The API returned an error: ' + error);
    }
}

function extractHtmlContent(payload) {
    if (payload.mimeType === 'text/html') {
        return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    if (payload.parts) {
        for (let part of payload.parts) {
            let htmlContent = extractHtmlContent(part);
            if (htmlContent) return htmlContent;
        }
    }
    return null;
}

async function handleMessage(auth, messageId, subject, snippet, Name) {
    //console.log('Handling message with ID: ', messageId);
    const gmail = google.gmail({ version: 'v1', auth });
    let formattedDate;
    let filePath;
    try {
        let message = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });

        
        let headersContent = '<html><head></head><body>';
        let emailContent = extractHtmlContent(message.data.payload) || '';

        if (message.data.payload && message.data.payload.headers) {
            for (let header of message.data.payload.headers) {
                //console.log(`Header: ${header.name}, Value: ${header.value}`);
                if (header.name === 'Date') {
                    let date = new Date(header.value);
                    formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
                }  else if (header.name === 'Subject') {
                    headersContent += `<p><b>${header.name}:</b> ${header.value}</p>`;
                }
            }
        }

        emailContent = headersContent + emailContent;
        //console.log(`Final Email Content: ${emailContent}`);
        if (message.data.snippet) {
            emailContent += `<p>${message.data.snippet}</p>`;
        }
        emailContent += '</body></html>';

        //console.log('Formatted Date: ', formattedDate);
        
        filePath = path.join(__dirname, 'ptoletter', `${Name} pto.pdf`);
        // Using puppeteer to create PDF
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(emailContent, { waitUntil: 'networkidle0' });
        await page.pdf({ path: filePath, format: 'A4' });
        await browser.close();

        //console.log('Email content written to: ', filePath);
        return { ptodate: formattedDate, filepath: filePath };
        // Construct the JSON output
        const result = { ptodate: formattedDate, filepath: filePath };

        // Define the output directory and file path
        const jsonOutputDir = path.join(__dirname, 'jsons');
        const jsonFilePath = path.join(jsonOutputDir, `${Name}_pto.json`);

        // Ensure the directory exists
        if (!fs.existsSync(jsonOutputDir)) {
            fs.mkdirSync(jsonOutputDir);
        }

        // Write the JSON output to the file
        fs.writeFileSync(jsonFilePath, JSON.stringify(result, null, 4));

        console.log(`JSON saved to: ${jsonFilePath}`);

        return { result, jsonFilePath };
    } catch (error) {
        console.error('Error in handleMessage: ', error);
        return { error: error.message };
    }
}
// Updated top-level code to handle potential promise rejection
authorize()
    .then(auth => listMessages(auth, Address, Name))
    .catch(error => {
        console.error("Error occurred:", error);
        // Print a known error structure to be handled by the parent
        console.log(JSON.stringify({ error: error.message }));
		//sleep(5000);
    });
