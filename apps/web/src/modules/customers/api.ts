import { apiRequest } from "@/lib/http/client";
import type {
  ApiCustomer,
  CreateCustomerBody,
  CustomerListResponse,
  UpdateCustomerBody,
} from "@/modules/customers/types";

export type ListCustomersQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
};

export const customersApi = {
  list(query: ListCustomersQuery = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    if (query.search?.trim()) params.set("search", query.search.trim());
    return apiRequest<CustomerListResponse>(`/customers?${params.toString()}`);
  },

  get(id: string) {
    return apiRequest<ApiCustomer>(`/customers/${id}`);
  },

  create(body: CreateCustomerBody) {
    return apiRequest<ApiCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update(id: string, body: UpdateCustomerBody) {
    return apiRequest<ApiCustomer>(`/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  remove(id: string) {
    return apiRequest<void>(`/customers/${id}`, { method: "DELETE" });
  },
};
