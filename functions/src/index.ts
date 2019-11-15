import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as bodyParser from 'body-parser';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

admin.initializeApp(functions.config().firebase);
const fireStore = admin.firestore();

const time_to_expire_skyway_id = 604800;
const COLLECTION_WAITERS = 'waiters_test'
const COLLECTION_IMAGES: string = 'images';
const SUB_COLLECTION_IMAGES: string = 'images';

const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send({'status': 'ok'})
});

app.get('/waiters', (req, res) => {
  console.log('GET /waiters');

  // returns valid skyway_ids
  fireStore.collection(COLLECTION_WAITERS)
    .where('expired_at', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now())))
    .orderBy('expired_at', 'desc')
    .get()
    .then(querySnapshot => {
      const rets: any = [];
      querySnapshot.forEach(doc => {
        rets.push({
          skyway_id: doc.id
          ,phi: doc.data().phi
          ,theta: doc.data().theta
        });
      })
      res.send(rets);
    })
    .catch(err => {
      res.status(400).send({
        status: 'query error',
        response: err
      });
    });
});

/**
 * URL: /waiters
 * method: POST
 */
app.post('/waiters', (req, res) => {
  // console.log(req.body);
  console.log('POST /waiters');
  const skyway_id = req.body.skyway_id;
  const phi :number = req.body.phi;
  const theta :number = req.body.theta;

  // update firestore.
  add_waiter(skyway_id, phi, theta, (ret: any) => {
    fireStore.collection(COLLECTION_WAITERS)
    .where('expired_at', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now())))
    .where('phi', '==', phi)
    .where('theta', '==', theta)
    .orderBy('expired_at', 'desc')
    .get()
    .then(querySnapshot => {
      if (querySnapshot.empty) {
        // console.log('Empty QuerySnapshot');
        res.send({
          skyway_id: null
        })
      } else {
        // console.log("At least 1 document was found.");
        let noDocFound: Boolean = true;
        querySnapshot.forEach((doc) => {
          if (doc.data().skyway_id === skyway_id) {
            // continue
          } else {
            noDocFound = false;
            res.send({
              skyway_id: doc.id
            });
          }
        });
        if (noDocFound) {
          res.send({
            skyway_id: null
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
});

function add_waiter(skyway_id: string, phi: number, theta: number, callback: Function): any {
  const expire_date = new Date();
  expire_date.setSeconds(expire_date.getSeconds() + time_to_expire_skyway_id);

  // create new record.
  const data = {
    skyway_id: skyway_id
    ,phi: phi
    ,theta: theta
    ,created_at: new Date(Date.now())
    ,expired_at: admin.firestore.Timestamp.fromDate(expire_date)
  }

  fireStore.collection(COLLECTION_WAITERS)
    .doc(skyway_id)
    .set(data)
    .then(result => {
      // console.log('Set document succeeded.');
      const ret = {
        status: 200
        ,response: {
          skyway_id: null
          ,created_data: data
        }
      }
      callback(ret);
    })
    .catch(err => {
      // console.log('Set document failed.');
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
  console.log('DELETE /waiters');
  const skyway_id = req.body.skyway_id;
  console.log('delete skyway_id: ' + skyway_id);

  fireStore.collection(COLLECTION_WAITERS)
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

app.get('/images/:skyway_id', (req, res) => {
  const skyway_id: string = req.params.skyway_id;
  console.log('GET /images/' + skyway_id);

  fireStore.collection(COLLECTION_IMAGES)
    .doc(skyway_id)
    .collection(SUB_COLLECTION_IMAGES)
    .get()
    .then(querySnapshot => {
      const rets: any[] = []
      querySnapshot.forEach(doc => {
        rets.push({
          image: doc.data().image
        });
      })
      res.send(rets);
    })
    .catch(err => {
      res.status(400).send({
        status: 'Image request failed.'
        ,response: err
      });
    });
});

app.post('/images/:skyway_id', (req, res) => {
  const skyway_id: string = req.params.skyway_id;
  console.log('POST /images/' + skyway_id);
  const image: string = req.body.image;

  const data = {
    skyway_id: skyway_id
    ,image: image
    ,created_at: new Date(Date.now())
  }

  fireStore.collection(COLLECTION_IMAGES)
    .doc(skyway_id)
    .collection(SUB_COLLECTION_IMAGES)
    .doc()
    .set(data)
    .then(result => {
      res.send({
        status: 'Image uploading succeeded.'
        ,response: result
      })
    })
    .catch(err => {
      res.status(400)
        .send({
          status: 'Image uploading failed.'
          ,response: err
        });
    });
});

exports.v1 = functions.https.onRequest(app);