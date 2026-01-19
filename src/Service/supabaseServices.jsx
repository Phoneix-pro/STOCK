import { supabase } from '.../supabaseClient'

export const stockService = {
  // Get all stocks
  async getStocks() {
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Create new stock                                   
  async createStock(stockData) {
    const { data, error } = await supabase
      .from('stocks')
      .insert([stockData])
      .select()
    
    if (error) throw error
    return data[0]
  },

  // Update stock
  async updateStock(id, updates) {
    const { data, error } = await supabase
      .from('stocks')
      .update(updates)
      .eq('id', id)
      .select()
    
    if (error) throw error
    return data[0]
  },

  // Delete stock
  async deleteStock(id) {
    const { error } = await supabase
      .from('stocks')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

export const productionService = {
  // Get all production departments
  async getDepartments() {
    const { data, error } = await supabase
      .from('production_departments')
      .select('*')
    
    if (error) throw error
    return data
  },

  // Create production department
  async createDepartment(name) {
    const { data, error } = await supabase
      .from('production_departments')
      .insert([{ name }])
      .select()
    
    if (error) throw error
    return data[0]
  },

  // Get production items with stock details
  async getProductionItems() {
    const { data, error } = await supabase
      .from('production_items')
      .select(`
        *,
        stocks (
          bare_code,
          part_no,
          name,
          price
        )
      `)
    
    if (error) throw error
    return data
  }
}

export const salesService = {
  // Get all sales with stock details
  async getSales() {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        stocks (
          bare_code,
          part_no,
          name,
          price
        )
      `)
    
    if (error) throw error
    return data
  },

  // Create sale
  async createSale(saleData) {
    const { data, error } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
    
    if (error) throw error
    return data[0]
  }
}