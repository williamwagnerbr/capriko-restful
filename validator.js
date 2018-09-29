var validator = {
  fn: {
    ok: function (value, dataset, params, cb) {
      cb.ok()
    },
    error: function (value, dataset, params, cb) {
      cb.error()
    }
  },
  factory: function (fields, params, fn) {
    if (Array.isArray(fields)) {
      fields = fields.join(',')
    }

    return {
      field: fields,
      params: params,
      validate: fn
    }
  },
  utils: {
    validateSync: function (rule, values, cb) {
      var fields = rule.field.split(',')
      var tasks = []

      fields.forEach(function (field) {
        tasks.push(new Promise(function (resolve, reject) {
          var targetValue = null

          if (values[field]) {
            targetValue = values[field]
          }

          var callbacks = {
            ok: function () {
              resolve({
                error: false
              })
            },
            error: function (data) {
              resolve({
                error: true,
                data: data
              })
            },
            raw: function (err, result) {
              if (err) {
                return reject(err)
              }
              resolve(result)
            }
          }

          rule.validate(targetValue, Object.assign({}, values), rule.params, callbacks)
        }))
      })

      Promise.all(tasks)
        .then(function (data) {
          cb(null, data)
        })
        .catch(function (err) {
          cb(null, err)
        })
    },
    validateAllSync: function (rules, values, cb) {
      var tasks = []

      rules.forEach(function (rule) {
        tasks.push(new Promise(function (resolve, reject) {
          capriko.validator.validate(rule, values, function (err, result) {
            if (err) {
              return reject(err)
            }

            resolve(result)
          })
        }))
      })

      Promise.all(tasks)
        .then(function (data) {
          cb(null, data)
        })
        .catch(function (err) {
          cb(null, err)
        })
    },
    validate: function (rule, values) {
      return new Promise(function (resolve, reject) {
        capriko.validator.validate(rule, values, function (err, result) {
          if (err) {
            return reject(err)
          }
          resolve(result)
        })
      })
    },
    validateAll: function (rules, values) {
      return new Promise(function (resolve, reject) {
        capriko.validator.validateAll(rules, values, function (err, result) {
          if (err) {
            return reject(err)
          }
          resolve(result)
        })
      })
    }
  }  
}

// Client
validator.client = function () {
  var filters = {}
  
  var controller = {
    add: function (name, fn) {
      filters[name] = fn
      return this
    },
    remove: function (name) {
      delete (filters[name])
      return this
    },
    get: function (name) {
      return filters[name]
    }
    getAll: function () {
      return Object.keys(filters)
    },
    validateSync: function (rule, values, cb) {
      rule.validate = controller.get(rule.rule)
      return validator.utils.validateSync(rule, values, cb)
    },
    validateAllSync: function (rules, values, cb) {      
      return validator.utils.validateAllSync(rules.map(function (rule) {
        rule.validate = controller.get(rule.rule)
        return rule
      }), values, cb)
    }
  }

  return controller
}

validator.fn.compare = function (value, dataset, params, cb) {
  cb.error()
}

validator.fn.equals = function(value, dataset, params, cb) {
  cb.error()
}

// less than
validator.fn.lt = function(value, dataset, params, cb) {
  cb.error()
}

// greater than
validator.fn.gt = function(value, dataset, params, cb) {
  cb.error()
}

// mathAll | and
validator.fn.matchAll = function (value, dataset, params, cb) {
  cb.error()
}

// matchOne | or | at_least_one
validator.fn.matchOne = function (value, dataset, params, cb) {
  cb.error()
}

// matchReverse | not
validator.fn.matchReverse = function (key, value, dataset, params, cb) {
  var rule = params.rule
  validator.utils.validateSync(rule, dataset, function (err, response) {
    if (err) {
      return cb(err)
    }

    if (response.errors.length === 0) {
      return cb.error()
    }

    cb.ok()
  })
}

module.exports = validator

