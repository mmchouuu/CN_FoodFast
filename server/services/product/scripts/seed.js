const { Product } = require('../src/models');
(async () => {
  await Product.bulkCreate([
    { title: "Burger Bò", description: "Burger bò phô mai", price: 55000, images: ["burger.jpg"], category: "fastfood" },
    { title: "Gà Rán", description: "Gà rán giòn tan", price: 45000, images: ["chicken.jpg"], category: "fastfood" }
  ]);
  console.log('product seed done');
  process.exit(0);
})();
