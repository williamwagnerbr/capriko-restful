var validator = require('./validator')

var capriko = {
  parser: {
    default: function () {
      return {
        encode: function (raw, cb) {
          cb(null, raw)
        },
        decode: function (raw, cb) {
          cb(null, raw)
        }
      }
    }
  },
  storage: {
    default: function () {
      return {
        findAll: function (cb) {
          cb(throw new Error('not available yet'))
        },
        findOne: function (id, cb) {
          cb(throw new Error('not available yet'))
        },
        createOne: function (data, cb) {
          cb(throw new Error('not available yet'))
        },
        updateOne: function (id, data, cb) {
          cb(throw new Error('not available yet'))
        },
        deleteOne: function (id, cb) {
          cb(throw new Error('not available yet'))
        }
      }
    }
  },
  model: {
    default: function () {
      return {
        findAll: function (cb) {
          cb(throw new Error('not available yet'))
        },
        findOne: function (id, cb) {
          cb(throw new Error('not available yet'))
        },
        createOne: function (input, cb) {
          cb(throw new Error('not available yet'))
        },
        updateOne: function (id, input, cb) {
          cb(throw new Error('not available yet'))
        },
        deleteOne: function (id, cb) {
          cb(throw new Error('not available yet'))
        }
      }
    }
  },
  validator: validator,
  util: {},
  sanitize: null
}

capriko.util.bodyFilter = function (definition, data) {
  var parsed = {}
  var allowed = definition.allowed

  if (!definition.allowed) {
    allowed = Object.keys(data)
  }

  allowed.forEach(function (field) {
    if (data[field] !== undefined) {
      parsed[field] = data[field]
    }
  })

  if (definition.denied) {
    definition.denied.forEach(function (key) {
      if (parsed[key]) {
        delete (parsed[key])
      }
    })
  }

  return parsed
}

capriko.storage.knex = function (settings) {
  return {
    factory: function (userParams) {
      var defaultParams = {
        user: null,
        user_field: 'user_id'
      }

      var params = Object.assign({}, defaultParams, userParams)

      return {
        findAll: function (cb) {
          var query = settings.db(params.resource)

          if (params.user) {
            query.where(params.user_field, params.user)
          }

          query
            .then(function (rows) {
              cb(null, rows)
            })
            .catch(function (err) {
              cb(err)
            })
        },
        findOne: function (id, cb) {
          var query = settings.db(params.resource)

          if (params.user) {
            query.where(params.user_field, params.user)
          }

          query
            .where('id', id)
            .first()
            .then(function (row) {
              if (row) {
                cb(null, row)
              } else {
                cb(new Error('Record not found'))
              }
              return true
            })
            .catch(function (err) {
              cb(err)
            })
        },
        createOne: function (data, cb) {
          if (params.user) {
            data[params.user_field] = params.user
          }

          settings.db(params.resource)
            .insert(data)
            .returning('id')
            .then(function (row) {
              cb(null, row[0])
              return true
            })
            .catch(function (err) {
              console.log(err.toString())
              cb(new Error(err.toString()))
            })
        },
        updateOne: function (id, data, cb) {
          if (params.user) {
            data[params.user_field] = params.user
          }

          var query = settings.db(params.resource)

          if (params.user) {
            query.where(params.user_field, params.user)
          }

          query.where('id', id)
            .update(data)
            .then(function (row) {
              if (row.length < 1) {
                cb(new Error('Not updated'))
              } else {
                cb(null, true)
              }
              return true
            })
            .catch(function (err) {
              cb(err)
            })
        },
        deleteOne: function (id, cb) {
          var query = settings.db(params.resource)

          if (params.user) {
            query.where(params.user_field, params.user)
          }

          query.where('id', id)
            .delete()
            .then(function (row) {
              if (row.length < 1) {
                cb(new Error('Not updated'))
              } else {
                cb(null, true)
              }
            })
            .catch(function (err) {
              cb(err)
            })
        }
      }
    }
  }
}

capriko.model.simple = function (params) {
  if (!params.parser) {
    throw new Error("Param 'parser' not defined")
  }

  if (!params.storage) {
    throw new Error("Param 'storage' not defined")
  }

  // Default bodyFilter
  if (!params.bodyFilter) {
    params.bodyFilter = {
      allowed: null,
      denied: ['id']
    }
  }

  // Default validator
  if (!params.validator) {
    params.validator = function (data, cb) {
      cb(null, { errors: [] })
    }
  }

  function error (status, errCode, errData) {
    return {
      status: status,
      body: {
        error: errCode,
        detail: errData
      }
    }
  }

  function callEvent (event, data) {
    if (params.events && params.events[event]) {
      params.events[event](data)
    }
  }

  function callEventBlock (event, data, cb) {
    var wrapper = {
      continue: function () {
        cb(null, true)
      },
      stop: function () {
        cb(null, false)
      },
      raw: cb
    }

    if (params.events) {
      if (params.events[event]) {
        return params.events[event](data, wrapper)
      }
    }

    wrapper.continue()
  }

  return {
    findAll: function (callback) {
      params.storage.findAll(function (err, items) {
        if (err) {
          return callback(null, error(404, 'not_found'))
        }

        Promise.all(items.map(async function (item) {
          return new Promise(function (resolve, reject) {
            params.parser.decode(item, function (err, decoded) {
              if (err) {
                return reject(err)
              }
              resolve(decoded)
            })
          })
        }))
        .then(function (parsedItems) {
          callback(null, { status: 200, body: parsedItems })
        })
        .catch(function () {
          callback(null, error(500, 'fail_to_parse_content'))
        })
      })
    },
    findOne: function (id, callback) {
      params.storage.findOne(id, function (err, item) {
        if (err) {
          return callback(null, error(404, 'not_found'))
        }

        params.parser.decode(item, function (err, decoded) {
          if (err) {
            return callback(null, error(404, 'fail_to_parse_content'))
          }

          callback(null, { status: 200, body: decoded })
        })
      })
    },
    createOne: function (input, callback) {
      if (!input) {
        return callback(null, error(400, 'invalid_request'))
      }

      params.parser.encode(input, function (err, newVal) {
        if (err) {
          return callback(null, error(400, 'fail_to_parse_input'))
        }

        newVal = capriko.util.bodyFilter(params.bodyFilter, newVal)

        // Finish record register
        function finish () {
          params.storage.createOne(newVal, function (err, id) {
            if (err) {
              return callback(null, error(500, 'fail_to_create_record'))
            }

            console.log(id)

            params.storage.findOne(id, function (err, item) {
              if (err) {
                return callback(null, error(404, 'not_found'))
              }

              params.parser.decode(item, function (err, decoded) {
                if (err) {
                  return callback(null, error(500, 'fail_to_parse_content'))
                }

                callback(null, { status: 201, body: decoded })
                callEvent('after:create', {id: id, data: decoded})
              })
            })
          })
        }

        // Performs data validation
        params.validator(newVal, function (err, validation) {
          if (err) {
            return callback(null, error(500, 'validator_error'))
          }

          if (validation.errors.length > 0) {
            return callback(null, error(401, 'validation', validation.errors[0]))
          }

          // Before create hook
          callEventBlock('before:create', newVal, function (err, answer) {
            if (err || !answer) {
              return callback(null, error(500, 'stopped', { event: 'before:create' }))
            }

            finish()
          })
        })
      })
    },
    updateOne: function (id, input, callback) {
      if (!input) {
        return callback(null, error(400, 'invalid_request'))
      }

      if (!id) {
        return callback(null, error(400, 'invalid_request'))
      }

      params.storage.findOne(id, function (err, oldVal) {
        if (err) {
          return callback(null, error(404, 'not_found'))
        }

        var newVal = Object.assign({}, oldVal, input)

        params.parser.encode(newVal, function (err, newVal) {
          if (err) {
            return callback(null, error(400, 'fail_to_parse_input'))
          }

          newVal = capriko.util.bodyFilter(params.bodyFilter, newVal)

          function finish () {
            params.storage.updateOne(id, newVal, function (err) {
              if (err) {
                return callback(null, error(500, 'fail_to_update_content'))
              }

              params.storage.findOne(id, function (err, item) {
                if (err) {
                  return callback(null, error(404, 'not_found'))
                }

                params.parser.decode(item, function (err, decoded) {
                  if (err) {
                    return callback(null, error(500, 'fail_to_parse_content'))
                  }

                  callback(null, { status: 200, body: decoded })
                })// decode
              })// findOne
            })// updateOne
          }

          // Performs data validation
          params.validator(newVal, function (err, validation) {
            if (err) {
              return callback(null, error(500, 'validator_error'))
            }

            if (validation.errors.length > 0) {
              return callback(null, error(401, 'validation', validation.errors[0]))
            }

            finish()
          })
        })// encode
      })
    },
    deleteOne: function (id, callback) {
      if (!id) {
        return callback(null, { status: 400, body: 'invalid_request' })
      }

      params.storage.findOne(id, function (err, oldVal) {
        if (err) {
          return callback(null, { status: 404, body: 'not_found' })
        }

        params.storage.deleteOne(id, function (err) {
          if (err) {
            return callback(null, { status: 500, body: 'fail_to_delete_record' })
          }

          callback(null, { status: 200, body: 'Ok' })
        })
      })
    }
  }
}

module.exports = capriko
