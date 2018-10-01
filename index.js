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
          cb(new Error('not available yet'))
        },
        findOne: function (id, cb) {
          cb(new Error('not available yet'))
        },
        createOne: function (data, cb) {
          cb(new Error('not available yet'))
        },
        updateOne: function (id, data, cb) {
          cb(new Error('not available yet'))
        },
        deleteOne: function (id, cb) {
          cb(new Error('not available yet'))
        }
      }
    }
  },
  model: {
    default: function () {
      return {
        findAll: function (cb) {
          cb(new Error('not available yet'))
        },
        findOne: function (id, cb) {
          cb(new Error('not available yet'))
        },
        createOne: function (input, cb) {
          cb(new Error('not available yet'))
        },
        updateOne: function (id, input, cb) {
          cb(new Error('not available yet'))
        },
        deleteOne: function (id, cb) {
          cb(new Error('not available yet'))
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
        fks: {},
        pk: 'id'
      }

      var params = Object.assign({}, defaultParams, userParams)

      function buildQuery (query) {
        Object.keys(params.fks).forEach(function (field) {
          query.where(field, params.fks[field])
        })
        return query
      }

      function buildData (data) {
        Object.keys(params.fks).forEach(function (field) {
          data[field] = params.fks[field]
        })
        return data
      }

      return {
        findAll: function (cb) {
          buildQuery(settings.db(params.resource))
            .then(function (rows) {
              cb(null, rows)
              return null
            })
            .catch(function (err) {
              cb(err)
              return null
            })
        },
        findOne: function (id, cb) {
          buildQuery(settings.db(params.resource))
            .where(params.pk, id)
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
              return null
            })
        },
        createOne: function (data, cb) {
          settings.db(params.resource)
            .insert(buildData(data))
            .returning(params.pk)
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
          buildQuery(settings.db(params.resource))
            .where(params.pk, id)
            .update(buildData())
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
          buildQuery(settings.db(params.resource))
            .where(params.pk, id)
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
    _getParams: function () {
      return params
    },
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
    },
    updateAll: function (input, callback) {
      var that = this

      if (!input) {
        return callback(new Error('invalid_request'))
      }

      if (!Array.isArray(input)) {
        return callback(new Error('invalid_request'))
      }

      function updateResponse (oldValues, newValues) {
        var response = {
          create: [],
          update: [],
          delete: []
        }

        newValues.forEach(function (item) {
          if (!item.id) {
            response.create.push(item)
            return null
          }      
        })

        oldValues.forEach(function (a) {
          var found = null

          newValues.forEach(function (b) {
            if (!b.id) {
              return false
            }

            if (b.id === a.id) {
              found = b
            }
          })

          if (found !== null) {
            response.update.push(found)
          } else {
            response.delete.push(a)
          }
        })

        return response
      }

      params.storage.findAll(function (err, items) {
        if (err) {
          return callback(err)
        }

        var response = updateResponse(items, input)
        var promises = []

        var promiseCb = function (resolve, reject) {
          return function (err, response) {
            if (err) {
              return reject(err)
            }

            if (response.status === 200 || response.status === 201) {
              resolve(true)
            } else {
              resolve(false)
            }
          } 
        }

        response.create.forEach(function (item) {
          promises.push(new Promise(function (resolve, reject) {
            that.createOne(item, promiseCb(resolve, reject))
          }))
        })

        response.update.forEach(function (item) {
          promises.push(new Promise(function (resolve, reject) {
            that.updateOne(item.id, item, promiseCb(resolve, reject))
          }))
        })

        response.delete.forEach(function (item) {
          promises.push(new Promise(function (resolve, reject) {
            that.deleteOne(item.id, promiseCb(resolve, reject))
          }))
        })

        Promise.all(promises)
          .then(function (rr) {
            that.findAll(function (err, response) {
              callback(err, response)
            })
          })
          .catch(function (err) {
            callback(err)
          })
      })
    }
  }
}

capriko.util.express = {
  handler: function (req, res, next) {
    return function (err, response) {
      if (err) {
        return res.status(500).send('unexpected_error')
      }

      res.status(response.status).send(response.body)
    }
  }
}

module.exports = capriko
