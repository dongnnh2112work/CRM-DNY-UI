export type CustomerType = "INDIVIDUAL" | "COMPANY";

export type ApiCustomer = {
  id: string;
  type: CustomerType;
  ownerId: string;
  industryOrField: string | null;
  legalName: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerListResponse = {
  items: ApiCustomer[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateCustomerBody = {
  type: CustomerType;
  legalName: string;
  displayName: string;
  industryOrField?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  ownerId?: string;
};

export type UpdateCustomerBody = Partial<CreateCustomerBody>;
