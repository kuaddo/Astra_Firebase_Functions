import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as bodyParser from 'body-parser';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

admin.initializeApp(functions.config().firebase);
const fireStore = admin.firestore();

const time_to_expire_skyway_id = 604800;
const sky_radius = 100;

const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send({'status': 'ok'})
});

/**
 * URL: /waiters
 * method: POST
 */
app.post('/waiters', (req, res) => {
  console.log(req.body);
  const skyway_id = req.body.skyway_id;
  const x :number = req.body.x;
  const y :number = req.body.y;
  const z :number = req.body.z;
  

  // search firestore;
  fireStore.collection('waiters_test')
    .where('expired_at', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now())))
    .orderBy('expired_at', 'desc')
    .get()
    .then(querySnapshot => {
      if (querySnapshot.empty) {
        console.log('Empty QuerySnapshot');
        add_waiter(skyway_id, x, y, z, (ret: any) => {
          res.status(ret.status).send(ret.response);
        });
      } else {
        console.log('Search QuerySnapshot. length:' + querySnapshot.size);
        let closest_doc_data: any = null;
        let closest_dist: number = 2 * sky_radius;
        let count = 0;
        querySnapshot.forEach(doc => {
          const data = doc.data();
          const distance = Math.sqrt(Math.pow(data.x-x, 2) + Math.pow(data.y-y, 2) + Math.pow(data.z-z, 2));
          if (distance <= sky_radius/10) {
            if (distance < closest_dist){
              closest_dist = distance;
              closest_doc_data = doc;
            }
          }
          count++;
        });

        console.log('QuerySnapshot Search Finished. count:' + count);
        if (closest_doc_data != null) {
          console.log('Return matched document.');
          res.send({
            status: 'found.'
            ,skyway_id: closest_doc_data.id
            ,doc: closest_doc_data.data()
          });
          
        } else {
          console.log('Valid document not found.');
          add_waiter(skyway_id, x, y, z, (ret: any) => {
            res.status(ret.status).send(ret.response);
          });
        }
      }
    })
    .catch(err => {
      res.send({
        status: 'query error',
        response: err
      });
    });
});

function add_waiter(skyway_id: string, x: number, y: number, z: number, callback: Function): any {
  const expire_date = new Date();
  expire_date.setSeconds(expire_date.getSeconds() + time_to_expire_skyway_id);

  // create new record.
  const data = {
    skyway_id: skyway_id
    ,x: x
    ,y: y
    ,z: z
    ,expired_at: admin.firestore.Timestamp.fromDate(expire_date)
  }
  console.log(data);
  fireStore.collection('waiters_test')
    .doc(skyway_id)
    .set(data)
    .then(result => {
      console.log('Set document succeeded.');
      const ret = {
        status: 200
        ,response: {
          status: 'keep wait.'
          ,skyway_id: null
          ,created_data: data
          ,response: result
        }
      }
      callback(ret);
    })
    .catch(err => {
      console.log('Set document failed.');
      const ret = {
        status: 400
        ,response: {
          status: 'error',
          response: err
        }
      }
      callback(ret);
    });
}

app.delete('/waiters', (req, res) => {
  const skyway_id = req.body.skyway_id;
  console.log('delete skyway_id: ' + skyway_id);

  fireStore.collection('waiters_test')
    .doc(skyway_id)
    .delete()
    .then(result => {
      res.send({
        status: 'successfully deleted.'
        ,response: result
      });
    })
    .catch(err => {
      res.status(400)
        .send({
          status: 'error occured.'
          ,response: err
        });
    });
})

exports.v1 = functions.https.onRequest(app);