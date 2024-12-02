const express = require('express');
const { Connection, ProgramCall } = require('itoolkit');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const port = 3000; // Bisa diganti sesuai kebutuhan

// Middleware untuk parsing JSON
app.use(express.json());

// Membuat koneksi ke AS400
const connection = new Connection({
    transport: 'ssh',
    transportOptions: {
        host: 'pub400.com',
        port: 2222,
        username: '',
        password: '',
    },
});

// Endpoint untuk memanggil program WSINQJDWL
app.get('/call-wsinqjdwl', (req, res) => {
    // Menyiapkan parameter untuk program
    const receiver = {
        name: 'WSINQJDWL', // Nama program
        type: 'ds', // Tipe parameter, disesuaikan dengan definisi DS pada program RPGLE
        fields: [
            { name: 'INIM', type: '10A', value: req.body.INIM || '' }, // NIM dari body string
            { name: 'ONIM', type: '10A', value: req.body.ONIM || '' },
            { name: 'ONMHS', type: '40A', value: req.body.ONMHS || '' },
            { name: 'ONPRD', type: '40A', value: req.body.ONPRD || '' },
            { name: 'OAMOUNTDATA', type: '10A', value: req.body.OAMOUNTDATA || '' },
            { name: 'ORESP', type: '2A', value: req.body.ORESP || '' },
            { name: 'ORESPDSC', type: '40A', value: req.body.ORESPDSC || '' },
            { name: 'OFFREE', type: '540A', value: req.body.OFFREE || '' },
        ],
    }; 

    // Membuat objek ProgramCall untuk memanggil program WSINQJDWL
    const command = new ProgramCall('WSINQJDWL', { lib: '' });
    command.addParam(receiver);

    // Menambahkan command ke koneksi
    connection.add(command);

    // Menjalankan command
    connection.run((error, xmlOutput) => {
        if (error) {
            // Jika terjadi error, mengirimkan status 500 dan detail error
            return res.status(500).json({ error: 'Error executing AS400 command', details: error });
        }

        // Parsing XML output dari program RPGLE
        console.log('XML Output:', xmlOutput); // Debugging XML output
        const parser = new XMLParser();
        const result = parser.parse(xmlOutput);

        // Menangani array 'OFFREE'
        let offreeData = result.myscript.pgm.parm.ds.data[7];  // 'OFFREE' ada di indeks 7
        let subArrays = [];
        const subArraySize = 108;  // Ukuran tiap elemen array

        for (let i = 0; i < offreeData.length; i += subArraySize) {
            let subArray = offreeData.substring(i, i + subArraySize);
            subArrays.push({
                KD_MATA_KULIAH: subArray.substring(0, 8).trim(),
                NAMA_MATA_KULIAH: subArray.substring(8, 58).trim(),
                NIP: subArray.substring(58, 68).trim(),
                NAMA_DOSEN: subArray.substring(68, 108).trim(),
            });
        }

        // Menyusun data yang telah diparsing
        let responseData = {
            InputNim: result.myscript.pgm.parm.ds.data[0],
            NIM: result.myscript.pgm.parm.ds.data[1],
            Nama_Mahasiswa: result.myscript.pgm.parm.ds.data[2],
            Program_Studi: result.myscript.pgm.parm.ds.data[3],
            Jumlah_Data: result.myscript.pgm.parm.ds.data[4],
            Response: result.myscript.pgm.parm.ds.data[5],
            ResDesc: result.myscript.pgm.parm.ds.data[6],
            Jadwal: subArrays,
        };

        // Mengirimkan response dalam bentuk JSON
        res.json(responseData);
    });
});

// Menjalankan server Express.js
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
