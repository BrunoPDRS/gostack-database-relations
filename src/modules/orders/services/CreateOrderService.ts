import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    // Retorna um objeto contendo somente os ID's dos produtos solicitados
    const listaIdProducts = products.map(product => {
      return { id: product.id };
    });

    // Retorna uma lista com todos os dados dos produtos com os ID's solicitados
    const productData = await this.productsRepository.findAllById(
      listaIdProducts,
    );

    // Para cada produto solicitado, busca o item na lista de todos os dados dos produtos,
    // e retorna um novo array para poder preencher o preço
    const newProducts = products.map(productItem => {
      const myProduct = productData.filter(
        product => product.id === productItem.id,
      );

      if (!myProduct.length) {
        throw new AppError('Produto inválido.');
      }

      if (productItem.quantity > myProduct[0].quantity) {
        throw new AppError('Produto não possui estoque disponível.');
      }

      return {
        product_id: productItem.id,
        price: myProduct[0].price,
        quantity: productItem.quantity,
      };
    });

    // Monta um novo array contendo a quantidade do estoque atualizada para salvar os dados
    const idQtdeProduct = productData.map(item => {
      const productOriginal = products.filter(
        product => product.id === item.id,
      );

      return {
        id: item.id,
        quantity: item.quantity - productOriginal[0].quantity,
      };
    });

    await this.productsRepository.updateQuantity(idQtdeProduct);

    const { id } = await this.ordersRepository.create({
      customer,
      products: newProducts,
    });

    const order = await this.ordersRepository.findById(id);

    if (!order) {
      throw new AppError('Erro ao cadastrar pedido.');
    }

    return order;
  }
}

export default CreateOrderService;
