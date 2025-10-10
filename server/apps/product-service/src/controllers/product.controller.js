const service = require('../services/product.service');

async function list(req,res,next){
  try{
    const limit = parseInt(req.query.limit||20);
    const offset = parseInt(req.query.offset||0);
    const rows = await service.list({limit, offset});
    res.json({data: rows});
  }catch(err){ next(err); }
}

async function get(req,res,next){
  try{
    const p = await service.get(req.params.id);
    if(!p) return res.status(404).json({error:'not found'});
    res.json(p);
  }catch(err){ next(err); }
}

module.exports = { list, get };
