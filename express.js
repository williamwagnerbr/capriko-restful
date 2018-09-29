
module.exports = {
  actions: {
    findAll: function (params) {
      return function (req, res, next) {
        try {
          var virtual = null

          params.storageAdapter(function (err, storage) {
            if (err) {

            }

            virtual.storage = storage
          })

          virtual = capriko.model.virtual(params.virtual)
          virtual.findAll(function (err, response) {
            if (err) {
              return res.status(500).send('unexpected_error')
            }
            res.status(response.status).send(response.body)
          })
        } catch (e) {
          res.status(500).send('unexpected_error')
        }
      }
    }
  },
  all: function (settings) {
    return function (req, res, next) {
      var virtual = capriko.model.virtual({
        parser: settings.getParser(settings.resource),
        storage: settings.getStorage(settings.resource)
      })

      // find all
      if (settings.method === 'findAll') {
        virtual.findAll(function (err, response) {
          if (err) {
            return res.status(500).send('unexpected_error')
          }

          res.status(response.status).send(response.body)
        })
      }

      // update
      if (settings.method === 'update') {
        settings.getBody({req, res, next}, function (err, body) {
          if (err) {
            return res.status(500).send('unexpected_error')
          }

          virtual.updateOne(req.params.id, body, function (err, response) {
            if (err) {
              return res.status(500).send('unexpected_error')
            }
            res.status(response.status).send(response.body)
          })
        })
      }
    }
  }
}
