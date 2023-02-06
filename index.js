const express = require('express');
const multer = require('multer');
const csv = require('fast-csv');
const xlsx = require('xlsx');
const Chart = require('chart.js');
const AWS = require('aws-sdk');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.get('/',(req,res)=>{
    res.send('Hi')
})

app.post('/upload', upload.single('file'), (req, res) => {
  const csvData = [];
  csv
    .fromString(req.file.buffer.toString(), {
      headers: true,
      ignoreEmpty: true
    })
    .on('data', data => {
      csvData.push(data);
    })
    .on('end', () => {
      // Add serial number column
      for (let i = 0; i < csvData.length; i++) {
        csvData[i]['Serial Number'] = i + 1;
      }

      // Create XLSX file
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(csvData);
      xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
      const xlsxBuffer = xlsx.write(wb, { type: 'buffer' });

      // Create pie chart
      const maleCount = csvData.filter(data => data.Gender === 'Male').length;
      const femaleCount = csvData.filter(data => data.Gender === 'Female').length;
      const chart = new Chart(null, {
        type: 'pie',
        data: {
          labels: ['Male', 'Female'],
          datasets: [
            {
              data: [maleCount, femaleCount],
              backgroundColor: ['#007bff', '#dc3545']
            }
          ]
        }
      });
      const chartBuffer = chart.toBase64Image();

      // Upload files to S3
      const s3 = new AWS.S3();
      const xlsxKey = `xlsx/${Date.now()}.xlsx`;
      const chartKey = `pie/${Date.now()}.png`;
      const uploadPromises = [
        s3
          .upload({
            Bucket: 'my-bucket',
            Key: xlsxKey,
            Body: xlsxBuffer
          })
          .promise(),
        s3
          .upload({
            Bucket: 'my-bucket',
            Key: chartKey,
            Body: chartBuffer,
            ContentEncoding: 'base64',
            ContentType: 'image/png'
          })
          .promise()
      ];
  
      Promise.all(uploadPromises)
        .then(responses => {
          res.json({
            xlsxUrl: `https://s3.amazonaws.com/my-bucket/${xlsxKey}`,
            chartUrl: `https://s3.amazonaws.com/my-bucket/${chartKey}`
          });
    })
    })})

    app.listen(8000,()=>{
        console.log('port Started on 8080')
    })
