const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const keys =JSON.parse(process.env.SERVICE_KEY);
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const qs = require('querystring');
const caspioTokenUrl = 'https://c1abd578.caspio.com/oauth/token';
const clientID = process.env.clientID;
const clientSecret = process.env.clientSecret;
const GoggleApi = process.env.GoggleApi;
const { spawn } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const range = 'Sheet1!A2:A188';

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
    } else {
        console.log('No data found.');
        return null;
    }
}
async function fetchCaspioData(accessToken, url, data = null, method = 'GET') {
    try {
        let response;
        const headers = {
            'Authorization': `Bearer ${accessToken}`
        };

        switch (method.toUpperCase()) {
            case 'GET':
                response = await axios.get(url, { headers });
                break;
            case 'POST':
                response = await axios.post(url, data, { headers });
                break;
            case 'PUT':
                response = await axios.put(url, data, { headers });
                break;
            default:
                throw new Error(`Unsupported method: ${method}`);
        }

        return response.data;
    } catch (error) {
        console.error(`Error in fetchCaspioData: ${error}`);
        throw error;
    }
}

async function caspiomain(CIDvalue, accessToken) {
    try {
        const masterTableUrl = `https://c1abd578.caspio.com/rest/v2/tables/MasterTable/records?q.select=Name%2C%20Address1%2C%20Phone1%2C%20email&q.where=CID=${CIDvalue}`;
        const solarProcessUrl = `https://c1abd578.caspio.com/rest/v2/tables/SolarProcess/records?q.select=NYC_LI%2C%20Finance%2C%20System_Size_Sold%2C%20Panel%2C%20Number_Of_Panels%2C%20Contract_Price%2C%20Canopy_Used%2C%20Affordable%2C%20Solarinsure%2C%20number_of_systems&q.where=CustID=${CIDvalue}`;

        const masterDataResponse = await fetchCaspioData(accessToken, masterTableUrl);
        const solarProcessResponse = await fetchCaspioData(accessToken, solarProcessUrl);

        const masterData = masterDataResponse.Result[0];
        const solarData = solarProcessResponse.Result[0];

        const combinedData = { ...masterData, ...solarData };

        const originalAddress = combinedData.Address1;

        const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(originalAddress)}&key=${GoggleApi}`);
        const Address = response.data.results[0].formatted_address;
		const houseAndStreet = Address.split(',')[0]; 
        const CID = CIDvalue;
        const Name = combinedData.Name;
        const Phone = combinedData.Phone1;
        const email = combinedData.email;
        const Price = combinedData.Contract_Price;
        const NYC_LI = combinedData.NYC_LI;
        const Finance = combinedData.Finance;
        const Size = combinedData.System_Size_Sold;
        const Panel = combinedData.Panel;
        const Panel_count = combinedData.Number_Of_Panels;
        const permit_type = combinedData.Canopy_Used;
        const Affordable = combinedData.Affordable;
        const Solarinsure = combinedData.Solarinsure;

        return { CID, Name, Address,houseAndStreet, Phone, email, Price, NYC_LI, Finance, Size, Panel, Panel_count, permit_type, Affordable, Solarinsure };
    } catch (error) {
        console.error(`Error in main: ${error}`);
        if (error.response) {
            console.error('Error status:', error.response.status);
            console.error('Error data:', error.response.data);
        }
    }
}
async function fetchSpreadsheetDataForSheet2(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1147-lHNrN1eGso_Gb0KXzgVf3_Vlpw1IpnQAdzwZ-GY';
    
    try {
        let response = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            ranges: ['Sheet2!A1:D287'],
            fields: 'sheets.data.rowData.values.hyperlink,sheets.data.rowData.values.userEnteredValue'
        });

        const rows = response.data.sheets[0].data[0].rowData;
        let extractedData = [];

        for (let row of rows) {
            let dateofopening = row.values[0] && row.values[0].userEnteredValue ? row.values[0].userEnteredValue.stringValue : "N/A";
            let applicationnumber = row.values[1].userEnteredValue ? row.values[1].userEnteredValue.stringValue : null;
            let applicationLink = row.values[1].hyperlink;
            let fullAddress = row.values[3].userEnteredValue ? row.values[3].userEnteredValue.stringValue : null;
            let addressParts = fullAddress.split(',');
let mainParts = addressParts[0].split(' ');  // split the main address part by space

// exclude last three elements (borough, "NY", and ZIP code)
let houseAndStreet = mainParts.slice(0, -3).join(' ');        
            extractedData.push({
                dateofopening: dateofopening,
                applicationnumber: applicationnumber,
                applicationLink: applicationLink,
                houseAndStreet: houseAndStreet
            });
        }

        return extractedData;
        //console.log(extractedData);
    } catch (error) {
        console.error('Error fetching spreadsheet data:', error);
    }
}

async function fetchSpreadsheetbis(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1147-lHNrN1eGso_Gb0KXzgVf3_Vlpw1IpnQAdzwZ-GY';
    const range = 'Sheet1!A1:H1200';

    let response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    let rows = response.data.values;
    let data = [];  // This will hold the housestreets and permitnumbers

    if (rows.length) {
        // Skip the header
        for(let i = 1; i < rows.length; i++) {
            let row = rows[i];
            let housestreet = row[7];  // Column H
            let fullPermitNumber = row[1];  // Column B
            let extractedPermitNumber = fullPermitNumber ? fullPermitNumber.split('-')[0] : null;

            if (housestreet && extractedPermitNumber) {
                data.push({
                    housestreet: housestreet,
                    permitnumber: extractedPermitNumber
                });
            }
        }
        return data;
    } else {
        console.log('No data found.');
        return [];
    }
}
function normalizeAddress(address) {
    let normalized = address.toLowerCase();

    // Convert numbers separated by a dash
    normalized = normalized.replace(/(\d+)-(\d+)/g, '$1$2');

    // Replace specific words with their full version
    normalized = normalized.replace(/\be\b/g, 'east');
    normalized = normalized.replace(/\bw\b/g, 'west');
    normalized = normalized.replace(/\bn\b/g, 'north');
    normalized = normalized.replace(/\bs\b/g, 'south');
    normalized = normalized.replace(/\bpl\b/g, 'place');
    normalized = normalized.replace(/\brd\b/g, 'road');
    normalized = normalized.replace(/\bave\b|\bav\b/g, 'avenue');
    normalized = normalized.replace(/\bst\b/g, 'street');
    normalized = normalized.replace(/\bblvd\b/g, 'boulevard');

    // Remove ordinal indicators from street numbers
    normalized = normalized.replace(/(\d+)(st|nd|rd|th)\b/g, '$1');

    // Remove any extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}



function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    try {
        const client = new google.auth.JWT(
            keys.client_email,
            null,
            keys.private_key,
            [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ],
        );

        await client.authorize();
        const accessToken = await caspioAuthorization();
        console.log("Successfully connected to googlesheet!");
        console.log("Successfully connected to caspio!");

        //const sheetData = await fetchSpreadsheetData(client);
        const sheetData = [1];
        for (let i = 0; i < sheetData.length; i++) {
			sleep(10000);
            //////////// let custID = sheetData[i];
            let custID = process.argv[2];
            //let custID = '273';
            let caspioData = await caspiomain(custID, accessToken);
            console.log("Data: ", caspioData);

            let normalizedCaspioAddress = normalizeAddress(caspioData.houseAndStreet);
            const bisData = await fetchSpreadsheetDataForSheet2(client);
            //console.log(bisData);

            let matchingAddress = bisData.find(entry => {
                let normalizedBisAddress = normalizeAddress(entry.houseAndStreet);
                //console.log(normalizedBisAddress);
                return normalizedCaspioAddress === normalizedBisAddress;
            });
            let outputData = {}; // Initiate the outputData object here
            if (matchingAddress) {
                let applicationdate = matchingAddress.dateofopening;
                let electricalpermitnumber = matchingAddress.applicationnumber;
                let applicationLink = matchingAddress.applicationLink;

                let updateUrl = `https://c1abd578.caspio.com/rest/v2/tables/electricalpermit/records?q.where=CID=${custID}`;

                let updatedData = {
                    "CID": custID,
                    "DateOfOpening": applicationdate,
                    "ApplicationNumber": electricalpermitnumber,
                    "applicationLink": applicationLink
                };

                console.log('Data to be updated:', updatedData);
                await fetchCaspioData(accessToken, updateUrl, updatedData, 'POST');
				console.log(`caspiodata updated`);
            } else {
                console.log(`No matching address found for ${normalizedCaspioAddress}`);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

main().then(output => {
    //console.log('Final output:', output);
}).catch(err => {
    console.error('Error in main function:', err);
});
