const { spawn } = require('child_process');
const { google } = require('googleapis');
const keys = JSON.parse(process.env.SERVICE_KEY);
const caspioTokenUrl = 'https://c1abd578.caspio.com/oauth/token';
const clientID = process.env.clientID;
const clientSecret = process.env.clientSecret;
const axios = require('axios');
const qs = require('querystring');
const GoggleApi = process.env.GoggleApi;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCaspioData(accessToken, url, updateData = null, method = 'GET') {
	
    try {
        if (updateData) {
            const response = await axios.put(url, updateData, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.data;
        } else {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.data;
        }
    } catch (error) {
        console.error(`Error in fetchCaspioData: ${error}`);
        throw error;
    }
}
async function caspiomain(CIDvalue, accessToken) {
    try {
        const masterTableUrl = `https://c1abd578.caspio.com/rest/v2/tables/MasterTable/records?q.select=Name%2C%20Address1%2C%20Phone1%2C%20email&q.where=CID=${CIDvalue}`;
        const solarProcessUrl = `https://c1abd578.caspio.com/rest/v2/tables/SolarProcess/records?q.select=Contract_Price%2CPanel%2CSystem_Size_Sold%2CBlock%2CLot%2CBin%2CFlood_Zone%2CNYC_LI%2COath_Ecb_Violation%2CFlood_Zone%2CLandmark%2CBorough%2CStories%2CCB&q.where=CustID=${CIDvalue}`;
        const signedcontractsurl = `https://c1abd578.caspio.com/rest/v2/tables/Signed_contracts/records?q.select=DownloadLink&q.where=CustID=${CIDvalue}`;
        const masterDataResponse = await fetchCaspioData(accessToken, masterTableUrl);
		//console.log(masterDataResponse);
        const solarProcessResponse = await fetchCaspioData(accessToken, solarProcessUrl);
		//console.log(solarProcessResponse);
        const signedcontractResponse = await fetchCaspioData(accessToken, signedcontractsurl);
		//console.log(signedcontractResponse);
        const signedData = signedcontractResponse.Result[signedcontractResponse.Result.length - 1];
        const masterData = masterDataResponse.Result[0];
        const solarData = solarProcessResponse.Result[0];
        const combinedData = { ...masterData, ...solarData, ...signedData };
        let contractlink = combinedData.DownloadLink;
        let contractfileid = contractlink.split('id=')[1].split('&export=download')[0];
        const originalAddress = combinedData.Address1;
        const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(originalAddress)}&key=${GoggleApi}`);
        const Address = response.data.results[0].formatted_address;
        const Contract_Price = combinedData.Contract_Price;
        const Panel = combinedData.Panel;
        const Size = combinedData.System_Size_Sold;
        const Block = combinedData.Block;
        const Lot = combinedData.Lot;
        const Bin = combinedData.Bin;
        const CB = combinedData.CB;
        const Flood_Zone = combinedData.Flood_Zone;
        const Oath_Ecb_Violation = combinedData.Oath_Ecb_Violation;
        const Landmark = combinedData.Landmark;
        const Borough = combinedData.Borough;
        const lead = combinedData.Lead;
        const NYC_LI = combinedData.NYC_LI;
        const Stories = combinedData.Stories;
        let FullName = combinedData.Name; // Replace with your actual full name variable
        let nameParts = FullName.split(' ');
        let Firstname;
        let Lastname;
        if (nameParts.length >= 2) {
            Firstname = nameParts[0];
            Lastname = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 1) {
            Firstname = nameParts[0];
            Lastname = "";  // No last name available
        } else {
            console.error(`Could not parse first and last name from ${FullName}`);
        }
        let Addressp = Address;
        let addressParts = Addressp.split(',');
        // Get the house and street
        let houseStreetParts = addressParts[0].trim().split(' ');
        let houseNumberRegex = /^[\d\-A-Za-z]+/;  // Matches digits, hyphens and letters at the start
        let houseNumberMatch = houseStreetParts[0].match(houseNumberRegex);
        let House;
        let Street;
        if (houseNumberMatch) {
            House = houseNumberMatch[0];
            Street = houseStreetParts.slice(1).join(' ');
        } else {
            console.error(`Could not parse house number and street from ${addressParts[0]}`);
        }
        // Get the city
        let City = addressParts[1].trim();
        // Get the zip
// Use a regex to find the ZIP code in the entire address string
let zipRegex = /\b\d{5}\b/;  // Matches exactly 5 digits
let zipMatch = Addressp.match(zipRegex);
let Zip;
if (zipMatch) {
    Zip = zipMatch[0];
} else {
    console.error(`Could not find ZIP code in ${Addressp}`);
}

        return { Firstname, Lastname, FullName, Address, House, Street, City, lead, Zip, Landmark, CB, Panel, NYC_LI, Size, Stories, Borough, contractfileid, Contract_Price, Block, Lot, Bin, Flood_Zone, Oath_Ecb_Violation };
    } catch (error) {
        console.error(`Error in main: ${error}`);
        if (error.response) {
            console.error('Error status:', error.response.status);
            console.error('Error data:', error.response.data);
        }
    }
}


async function caspioAuthorization() {
    const requestBody = {
        grant_type: 'client_credentials',
        client_id: clientID,
        client_secret: clientSecret,
    };

    try {
        const response = await axios.post(caspioTokenUrl, qs.stringify(requestBody), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data.access_token;
    } catch (error) {
        console.error(`Error in caspioAuthorization: ${error}`);
        throw error;
    }
}


async function fetchSpreadsheetData(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1aXRq3yh7KMwFJmTBWGL74Hp56Vns8XGcsqwznIkO2tc';
    const range = 'Sheet1!A2:A60';
    
    let response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    let rows = response.data.values;
    let custIDs = [];
    if (rows.length) {
        rows.forEach(row => {
            let CustID = row[0];
            if (CustID) {
                custIDs.push(CustID);
            }
        });
        return custIDs;
        console.log(custIDs);
    } else {
        console.log('No data found.');
        return null;
    }
}
function runScript(scriptPath, ...args) {
    return new Promise((resolve, reject) => {
        let dataString = '';
        const process = spawn('node', [scriptPath, ...args]);

        process.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        process.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`child process exited with code ${code}`));
                return;
            }
            resolve(dataString);
        });
    });
}

async function main(Cust_ID, Lastname, FullName, house_street, electrical_ID) {
    try {
        // Starting ptoletter.js
        console.log(`Running ptoletter for cust_id = ${Cust_ID}`);
        let ptoletterOutput;
        try {
            ptoletterOutput = await runScript('./ptoletter.js', Cust_ID, Lastname, FullName, house_street);
            sendProgressUpdate(20, "Pto letter found and saved");
        } catch (error) {
            console.error("Error while running ptoletter.js:", error.message);
            sendProgressUpdate(0, "Error: Could not run ptoletter.js");
            return;
        }
        let ptoletterData = extractOutputData(ptoletterOutput);
        await sleep(5000);

        // Running electricalpermit.js
        if (electrical_ID && electrical_ID !== "") {
            await runScript('./electricalpermit.js', Cust_ID);
            sendProgressUpdate(40, "Electrical permit number found and updated caspio");
        } else {
            //console.log(`electricalpermit.js already ran for this customer before. Skipping...`);
            sendProgressUpdate(40, "electrical permit already updated");
        }

        //console.log(`Running electricaltest for cust_id = ${Cust_ID}`);
        const passinspectionOutput = await runScript('./electricaltest.js', Cust_ID, Lastname);
        let passinspectionData = extractOutputData(passinspectionOutput);
        sendProgressUpdate(65, "Electrical inspection result saved");
        await sleep(2000);

        //console.log(`Running nyccloseout for cust_id = ${Cust_ID}`);
        await runScript('./nyccloseout.js', Cust_ID, ptoletterData.ptodate, ptoletterData.filepath, passinspectionData.passdate, passinspectionData.passfilepath);
        sendProgressUpdate(100, "Closeout forms filled out and saved in google drive");
        await sleep(10000);
    } catch (error) {
        console.error(`Error in main: ${error.message}`);
        console.log("Error: Could not complete the process");
    }
}

// This function will be replaced with SSE or another method to communicate with the client
function sendProgressUpdate(percentage, message) {
    // Placeholder for sending progress updates to the client
    console.log(`Progress: ${percentage}% - ${message}`);
}


function extractOutputData(output) {
    try {
        // Split output by new lines and find the line that is a valid JSON
        const outputLines = output.trim().split('\n');
        for (const line of outputLines) {
            if (line.startsWith('{') && line.endsWith('}')) {
                return JSON.parse(line);
            }
        }
        throw new Error('No JSON data found in output.');
    } catch (err) {
        throw new Error(`Error parsing JSON data: ${err.message}`);
    }
}


async function processAllCustomers() {
    const client = new google.auth.JWT(
        keys.client_email,
        null,
        keys.private_key,
        [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.readonly'
        ],
    );
    await client.authorize();
    //console.log("Successfully connected to Caspio!");
    const accessToken = await caspioAuthorization();

    const sheetData = await fetchSpreadsheetData(client);
    for (let i = 0; i < sheetData.length; i++) {
        let Cust_ID = sheetData[i];
        const electricpermitexistsurl = `https://c1abd578.caspio.com/rest/v2/tables/electricalpermit/records?q.select=passdate&q.where=CID=${Cust_ID}`;
        let electrical_IDexist = await fetchCaspioData(accessToken, electricpermitexistsurl);
        //console.log(electrical_IDexist);
        // Check if Result[0] exists and if it does, get the passdate. Otherwise, set it to null.
        let electrical_ID = electrical_IDexist.Result && electrical_IDexist.Result[0] ? electrical_IDexist.Result[0].passdate : null;
        //console.log(electrical_ID);
        let caspioData = await caspiomain(Cust_ID, accessToken);
        //console.log(caspioData);
        const Lastname = caspioData.Lastname;
        let FullName = caspioData.FullName;
        let house_street = `${caspioData.House} ${caspioData.Street}`;
        //console.log(house_street);
        sendProgressUpdate(10, "Starting pto letter");
        await main(Cust_ID, Lastname, FullName, house_street, electrical_ID);
    }

}

// Start the process
processAllCustomers().catch(error => {
    console.error('An error occurred in processAllCustomers:', error);
});