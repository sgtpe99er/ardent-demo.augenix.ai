export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          email_templates: Json
          id: string
          pricing: Json
          updated_at: string
        }
        Insert: {
          email_templates?: Json
          id?: string
          pricing?: Json
          updated_at?: string
        }
        Update: {
          email_templates?: Json
          id?: string
          pricing?: Json
          updated_at?: string
        }
        Relationships: []
      }
      async_requests: {
        Row: {
          id: string
          business_id: string | null
          user_id: string | null
          task_type: string
          priority: number
          payload: Json
          status: string
          claimed_by: string | null
          claimed_at: string | null
          result: Json | null
          error: string | null
          retry_count: number
          max_retries: number
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          business_id?: string | null
          user_id?: string | null
          task_type: string
          priority?: number
          payload?: Json
          status?: string
          claimed_by?: string | null
          claimed_at?: string | null
          result?: Json | null
          error?: string | null
          retry_count?: number
          max_retries?: number
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string | null
          user_id?: string | null
          task_type?: string
          priority?: number
          payload?: Json
          status?: string
          claimed_by?: string | null
          claimed_at?: string | null
          result?: Json | null
          error?: string | null
          retry_count?: number
          max_retries?: number
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "async_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "async_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: aa_demo_users
            referencedColumns: ["id"]
          }
        ]
      }
      brand_assets: {
        Row: {
          awards: Json | null
          brand_colors: string[] | null
          brand_fonts: string[] | null
          business_card_back_url: string | null
          business_card_front_url: string | null
          business_id: string | null
          certifications: Json | null
          color_preference: string | null
          created_at: string
          existing_logo_url: string | null
          existing_website_url: string | null
          facebook_page_url: string | null
          faqs: Json | null
          font_preference: string | null
          has_brand_colors: boolean | null
          has_brand_fonts: boolean | null
          has_business_card: boolean | null
          has_existing_logo: boolean | null
          has_existing_website: boolean | null
          has_facebook_page: boolean | null
          id: string
          inspiration_notes: string | null
          inspiration_urls: Json | null
          logo_urls: Json | null
          social_facebook: string | null
          social_google_business: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_other: Json | null
          social_tiktok: string | null
          social_x: string | null
          social_yelp: string | null
          social_youtube: string | null
          style_preference: string | null
          testimonials: Json | null
          tone_of_voice: string | null
          updated_at: string
          uploaded_inspiration: Json | null
          uploaded_logos: Json | null
          uploaded_other: Json | null
          uploaded_photos: Json | null
          uploaded_portfolio: Json | null
          uploaded_team_photos: Json | null
          user_id: string
        }
        Insert: {
          awards?: Json | null
          brand_colors?: string[] | null
          brand_fonts?: string[] | null
          business_card_back_url?: string | null
          business_card_front_url?: string | null
          business_id?: string | null
          certifications?: Json | null
          color_preference?: string | null
          created_at?: string
          existing_logo_url?: string | null
          existing_website_url?: string | null
          facebook_page_url?: string | null
          faqs?: Json | null
          font_preference?: string | null
          has_brand_colors?: boolean | null
          has_brand_fonts?: boolean | null
          has_business_card?: boolean | null
          has_existing_logo?: boolean | null
          has_existing_website?: boolean | null
          has_facebook_page?: boolean | null
          id?: string
          inspiration_notes?: string | null
          inspiration_urls?: Json | null
          logo_urls?: Json | null
          social_facebook?: string | null
          social_google_business?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_other?: Json | null
          social_tiktok?: string | null
          social_x?: string | null
          social_yelp?: string | null
          social_youtube?: string | null
          style_preference?: string | null
          testimonials?: Json | null
          tone_of_voice?: string | null
          updated_at?: string
          uploaded_inspiration?: Json | null
          uploaded_logos?: Json | null
          uploaded_other?: Json | null
          uploaded_photos?: Json | null
          uploaded_portfolio?: Json | null
          uploaded_team_photos?: Json | null
          user_id: string
        }
        Update: {
          awards?: Json | null
          brand_colors?: string[] | null
          brand_fonts?: string[] | null
          business_card_back_url?: string | null
          business_card_front_url?: string | null
          business_id?: string | null
          certifications?: Json | null
          color_preference?: string | null
          created_at?: string
          existing_logo_url?: string | null
          existing_website_url?: string | null
          facebook_page_url?: string | null
          faqs?: Json | null
          font_preference?: string | null
          has_brand_colors?: boolean | null
          has_brand_fonts?: boolean | null
          has_business_card?: boolean | null
          has_existing_logo?: boolean | null
          has_existing_website?: boolean | null
          has_facebook_page?: boolean | null
          id?: string
          inspiration_notes?: string | null
          inspiration_urls?: Json | null
          logo_urls?: Json | null
          social_facebook?: string | null
          social_google_business?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_other?: Json | null
          social_tiktok?: string | null
          social_x?: string | null
          social_yelp?: string | null
          social_youtube?: string | null
          style_preference?: string | null
          testimonials?: Json | null
          tone_of_voice?: string | null
          updated_at?: string
          uploaded_inspiration?: Json | null
          uploaded_logos?: Json | null
          uploaded_other?: Json | null
          uploaded_photos?: Json | null
          uploaded_portfolio?: Json | null
          uploaded_team_photos?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      brand_guides: {
        Row: {
          border_radius: Json | null
          colors: Json | null
          confidence_score: number | null
          css_variables: string | null
          customer_id: string | null
          extracted_at: string | null
          extraction_model: string | null
          id: string
          is_active: boolean | null
          job_id: string | null
          shadows: Json | null
          spacing: Json | null
          typography: Json | null
          ui_patterns: Json | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          border_radius?: Json | null
          colors?: Json | null
          confidence_score?: number | null
          css_variables?: string | null
          customer_id?: string | null
          extracted_at?: string | null
          extraction_model?: string | null
          id?: string
          is_active?: boolean | null
          job_id?: string | null
          shadows?: Json | null
          spacing?: Json | null
          typography?: Json | null
          ui_patterns?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          border_radius?: Json | null
          colors?: Json | null
          confidence_score?: number | null
          css_variables?: string | null
          customer_id?: string | null
          extracted_at?: string | null
          extraction_model?: string | null
          id?: string
          is_active?: boolean | null
          job_id?: string | null
          shadows?: Json | null
          spacing?: Json | null
          typography?: Json | null
          ui_patterns?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_guides_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: aa_demo_users
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_guides_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "migration_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_street: string | null
          address_zip: string | null
          amount_paid: number | null
          associations: Json | null
          business_name: string | null
          competitor_urls: Json | null
          created_at: string
          description: string | null
          desired_domain: string | null
          domain_name: string | null
          domain_registered_at: string | null
          domain_registrant_contact: Json | null
          domain_renewal_price_usd: number | null
          domain_status: string
          email_public: string | null
          existing_domain: string | null
          hours: Json | null
          id: string
          industry: string | null
          insurance_info: string | null
          integrations_needed: Json | null
          languages_served: Json | null
          lead_form_fields: Json | null
          licenses: Json | null
          location_city: string | null
          location_country: string | null
          location_state: string | null
          needs_domain_purchase: boolean | null
          owns_domain: boolean | null
          payment_methods: Json | null
          payment_paid_at: string | null
          payment_status: string
          phone_primary: string | null
          phone_secondary: string | null
          primary_cta: string | null
          service_area_description: string | null
          service_area_radius: string | null
          service_keywords: Json | null
          services_products: string | null
          special_offers: Json | null
          status: string
          subscription_plan: string | null
          tagline: string | null
          target_audience: string | null
          target_locations: Json | null
          unique_selling_points: Json | null
          updated_at: string
          user_id: string
          vercel_order_id: string | null
          website_features: string[] | null
          website_notes: string | null
          year_established: number | null
        }
        Insert: {
          address_street?: string | null
          address_zip?: string | null
          amount_paid?: number | null
          associations?: Json | null
          business_name?: string | null
          competitor_urls?: Json | null
          created_at?: string
          description?: string | null
          desired_domain?: string | null
          domain_name?: string | null
          domain_registered_at?: string | null
          domain_registrant_contact?: Json | null
          domain_renewal_price_usd?: number | null
          domain_status?: string
          email_public?: string | null
          existing_domain?: string | null
          hours?: Json | null
          id?: string
          industry?: string | null
          insurance_info?: string | null
          integrations_needed?: Json | null
          languages_served?: Json | null
          lead_form_fields?: Json | null
          licenses?: Json | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          needs_domain_purchase?: boolean | null
          owns_domain?: boolean | null
          payment_methods?: Json | null
          payment_paid_at?: string | null
          payment_status?: string
          phone_primary?: string | null
          phone_secondary?: string | null
          primary_cta?: string | null
          service_area_description?: string | null
          service_area_radius?: string | null
          service_keywords?: Json | null
          services_products?: string | null
          special_offers?: Json | null
          status?: string
          subscription_plan?: string | null
          tagline?: string | null
          target_audience?: string | null
          target_locations?: Json | null
          unique_selling_points?: Json | null
          updated_at?: string
          user_id: string
          vercel_order_id?: string | null
          website_features?: string[] | null
          website_notes?: string | null
          year_established?: number | null
        }
        Update: {
          address_street?: string | null
          address_zip?: string | null
          amount_paid?: number | null
          associations?: Json | null
          business_name?: string | null
          competitor_urls?: Json | null
          created_at?: string
          description?: string | null
          desired_domain?: string | null
          domain_name?: string | null
          domain_registered_at?: string | null
          domain_registrant_contact?: Json | null
          domain_renewal_price_usd?: number | null
          domain_status?: string
          email_public?: string | null
          existing_domain?: string | null
          hours?: Json | null
          id?: string
          industry?: string | null
          insurance_info?: string | null
          integrations_needed?: Json | null
          languages_served?: Json | null
          lead_form_fields?: Json | null
          licenses?: Json | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          needs_domain_purchase?: boolean | null
          owns_domain?: boolean | null
          payment_methods?: Json | null
          payment_paid_at?: string | null
          payment_status?: string
          phone_primary?: string | null
          phone_secondary?: string | null
          primary_cta?: string | null
          service_area_description?: string | null
          service_area_radius?: string | null
          service_keywords?: Json | null
          services_products?: string | null
          special_offers?: Json | null
          status?: string
          subscription_plan?: string | null
          tagline?: string | null
          target_audience?: string | null
          target_locations?: Json | null
          unique_selling_points?: Json | null
          updated_at?: string
          user_id?: string
          vercel_order_id?: string | null
          website_features?: string[] | null
          website_notes?: string | null
          year_established?: number | null
        }
        Relationships: []
      }
      customer_inputs: {
        Row: {
          business_id: string | null
          created_at: string
          file_name: string | null
          id: string
          input_type: Database["public"]["Enums"]["customer_input_type"]
          metadata: Json
          mime_type: string | null
          notes: string
          source_url: string | null
          storage_path: string | null
          storage_url: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          input_type: Database["public"]["Enums"]["customer_input_type"]
          metadata?: Json
          mime_type?: string | null
          notes?: string
          source_url?: string | null
          storage_path?: string | null
          storage_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["customer_input_type"]
          metadata?: Json
          mime_type?: string | null
          notes?: string
          source_url?: string | null
          storage_path?: string | null
          storage_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_inputs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          id: string
          stripe_customer_id: string | null
        }
        Insert: {
          id: string
          stripe_customer_id?: string | null
        }
        Update: {
          id?: string
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      deployed_websites: {
        Row: {
          approval_status: string
          business_id: string | null
          created_at: string
          custom_domain: string | null
          deployed_at: string | null
          email_aliases_created: boolean
          email_dns_error: string | null
          email_dns_provisioned_at: string | null
          email_dns_status: string
          github_repo_name: string | null
          github_repo_url: string | null
          id: string
          live_url: string | null
          site_slug: string | null
          status: Database["public"]["Enums"]["website_status"] | null
          subdomain: string | null
          updated_at: string
          user_id: string
          vercel_deployment_id: string | null
          vercel_preview_url: string | null
          vercel_project_id: string | null
        }
        Insert: {
          approval_status?: string
          business_id?: string | null
          created_at?: string
          custom_domain?: string | null
          deployed_at?: string | null
          email_aliases_created?: boolean
          email_dns_error?: string | null
          email_dns_provisioned_at?: string | null
          email_dns_status?: string
          github_repo_name?: string | null
          github_repo_url?: string | null
          id?: string
          live_url?: string | null
          site_slug?: string | null
          status?: Database["public"]["Enums"]["website_status"] | null
          subdomain?: string | null
          updated_at?: string
          user_id: string
          vercel_deployment_id?: string | null
          vercel_preview_url?: string | null
          vercel_project_id?: string | null
        }
        Update: {
          approval_status?: string
          business_id?: string | null
          created_at?: string
          custom_domain?: string | null
          deployed_at?: string | null
          email_aliases_created?: boolean
          email_dns_error?: string | null
          email_dns_provisioned_at?: string | null
          email_dns_status?: string
          github_repo_name?: string | null
          github_repo_url?: string | null
          id?: string
          live_url?: string | null
          site_slug?: string | null
          status?: Database["public"]["Enums"]["website_status"] | null
          subdomain?: string | null
          updated_at?: string
          user_id?: string
          vercel_deployment_id?: string | null
          vercel_preview_url?: string | null
          vercel_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployed_websites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      domain_requests: {
        Row: {
          business_id: string | null
          created_at: string
          domain_price: number | null
          id: string
          markup_fee: number | null
          namecheap_order_id: string | null
          needs_domain: boolean | null
          requested_domain: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          domain_price?: number | null
          id?: string
          markup_fee?: number | null
          namecheap_order_id?: string | null
          needs_domain?: boolean | null
          requested_domain?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          domain_price?: number | null
          id?: string
          markup_fee?: number | null
          namecheap_order_id?: string | null
          needs_domain?: boolean | null
          requested_domain?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      edit_requests: {
        Row: {
          admin_notes: string | null
          business_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          request_description: string
          status: Database["public"]["Enums"]["edit_request_status"] | null
          target_page: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          business_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          request_description: string
          status?: Database["public"]["Enums"]["edit_request_status"] | null
          target_page?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          business_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          request_description?: string
          status?: Database["public"]["Enums"]["edit_request_status"] | null
          target_page?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      generated_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          business_id: string | null
          created_at: string
          id: string
          is_selected: boolean | null
          metadata: Json | null
          status: Database["public"]["Enums"]["asset_status"] | null
          storage_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          business_id?: string | null
          created_at?: string
          id?: string
          is_selected?: boolean | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          storage_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          business_id?: string | null
          created_at?: string
          id?: string
          is_selected?: boolean | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          storage_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      hosting_payments: {
        Row: {
          amount: number
          business_id: string | null
          created_at: string
          domain_fee: number | null
          hosting_end_date: string | null
          hosting_months: number
          hosting_start_date: string | null
          id: string
          paid_at: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          amount: number
          business_id?: string | null
          created_at?: string
          domain_fee?: number | null
          hosting_end_date?: string | null
          hosting_months: number
          hosting_start_date?: string | null
          id?: string
          paid_at?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          total_amount: number
          user_id: string
        }
        Update: {
          amount?: number
          business_id?: string | null
          created_at?: string
          domain_fee?: number | null
          hosting_end_date?: string | null
          hosting_months?: number
          hosting_start_date?: string | null
          id?: string
          paid_at?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hosting_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      migration_jobs: {
        Row: {
          asset_manifest_url: string | null
          brand_guide_url: string | null
          build_status: Json | null
          completed_pages: number
          component_library_url: string | null
          created_at: string
          customer_id: string
          error_log: string | null
          id: string
          metadata: Json | null
          migration_version: string | null
          status: Database["public"]["Enums"]["migration_job_status"]
          target_url: string
          total_pages: number
          updated_at: string
          wp_admin_username: string | null
          wp_application_password: string | null
        }
        Insert: {
          asset_manifest_url?: string | null
          brand_guide_url?: string | null
          build_status?: Json | null
          completed_pages?: number
          component_library_url?: string | null
          created_at?: string
          customer_id: string
          error_log?: string | null
          id?: string
          metadata?: Json | null
          migration_version?: string | null
          status?: Database["public"]["Enums"]["migration_job_status"]
          target_url: string
          total_pages?: number
          updated_at?: string
          wp_admin_username?: string | null
          wp_application_password?: string | null
        }
        Update: {
          asset_manifest_url?: string | null
          brand_guide_url?: string | null
          build_status?: Json | null
          completed_pages?: number
          component_library_url?: string | null
          created_at?: string
          customer_id?: string
          error_log?: string | null
          id?: string
          metadata?: Json | null
          migration_version?: string | null
          status?: Database["public"]["Enums"]["migration_job_status"]
          target_url?: string
          total_pages?: number
          updated_at?: string
          wp_admin_username?: string | null
          wp_application_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: aa_demo_users
            referencedColumns: ["id"]
          },
        ]
      }
      migration_pages: {
        Row: {
          created_at: string
          error_log: string | null
          id: string
          job_id: string
          metadata: Json
          mobile_screenshot_url: string | null
          original_html: string | null
          original_screenshot_url: string | null
          page_label: string | null
          render_priority: number | null
          retry_count: number
          rewritten_html: string | null
          rewritten_screenshot_url: string | null
          status: Database["public"]["Enums"]["migration_page_status"]
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          error_log?: string | null
          id?: string
          job_id: string
          metadata?: Json
          mobile_screenshot_url?: string | null
          original_html?: string | null
          original_screenshot_url?: string | null
          page_label?: string | null
          render_priority?: number | null
          retry_count?: number
          rewritten_html?: string | null
          rewritten_screenshot_url?: string | null
          status?: Database["public"]["Enums"]["migration_page_status"]
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          error_log?: string | null
          id?: string
          job_id?: string
          metadata?: Json
          mobile_screenshot_url?: string | null
          original_html?: string | null
          original_screenshot_url?: string | null
          page_label?: string | null
          render_priority?: number | null
          retry_count?: number
          rewritten_html?: string | null
          rewritten_screenshot_url?: string | null
          status?: Database["public"]["Enums"]["migration_page_status"]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_pages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "migration_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_discovery_items: {
        Row: {
          confidence: number | null
          created_at: string | null
          field_type: string
          field_value: Json
          id: string
          session_id: string | null
          source: string
          source_url: string | null
          status: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          field_type: string
          field_value: Json
          id?: string
          session_id?: string | null
          source: string
          source_url?: string | null
          status?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          field_type?: string
          field_value?: Json
          id?: string
          session_id?: string | null
          source?: string
          source_url?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_discovery_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "onboarding_discovery_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_discovery_sessions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          discovered_sources: Json | null
          entry_type: string
          entry_value: string
          entry_value_secondary: string | null
          id: string
          status: string | null
          user_id: string | null
          workflow_run_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          discovered_sources?: Json | null
          entry_type: string
          entry_value: string
          entry_value_secondary?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
          workflow_run_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          discovered_sources?: Json | null
          entry_type?: string
          entry_value?: string
          entry_value_secondary?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
          workflow_run_id?: string | null
        }
        Relationships: []
      }
      onboarding_responses: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          responses: Json
          step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          responses?: Json
          step: number
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          responses?: Json
          step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_responses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          note: string | null
          stripe_price_id: string
          stripe_price_ids: Json | null
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          stripe_price_id: string
          stripe_price_ids?: Json | null
          token?: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          stripe_price_id?: string
          stripe_price_ids?: Json | null
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      prices: {
        Row: {
          active: boolean | null
          currency: string | null
          description: string | null
          id: string
          interval: Database["public"]["Enums"]["pricing_plan_interval"] | null
          interval_count: number | null
          metadata: Json | null
          product_id: string | null
          trial_period_days: number | null
          type: Database["public"]["Enums"]["pricing_type"] | null
          unit_amount: number | null
        }
        Insert: {
          active?: boolean | null
          currency?: string | null
          description?: string | null
          id: string
          interval?: Database["public"]["Enums"]["pricing_plan_interval"] | null
          interval_count?: number | null
          metadata?: Json | null
          product_id?: string | null
          trial_period_days?: number | null
          type?: Database["public"]["Enums"]["pricing_type"] | null
          unit_amount?: number | null
        }
        Update: {
          active?: boolean | null
          currency?: string | null
          description?: string | null
          id?: string
          interval?: Database["public"]["Enums"]["pricing_plan_interval"] | null
          interval_count?: number | null
          metadata?: Json | null
          product_id?: string | null
          trial_period_days?: number | null
          type?: Database["public"]["Enums"]["pricing_type"] | null
          unit_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: aa_demo_products
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          description: string | null
          id: string
          image: string | null
          metadata: Json | null
          name: string | null
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          id: string
          image?: string | null
          metadata?: Json | null
          name?: string | null
        }
        Update: {
          active?: boolean | null
          description?: string | null
          id?: string
          image?: string | null
          metadata?: Json | null
          name?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created: string
          current_period_end: string
          current_period_start: string
          ended_at: string | null
          id: string
          metadata: Json | null
          price_id: string | null
          quantity: number | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          trial_end: string | null
          trial_start: string | null
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created?: string
          current_period_end?: string
          current_period_start?: string
          ended_at?: string | null
          id: string
          metadata?: Json | null
          price_id?: string | null
          quantity?: number | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          trial_end?: string | null
          trial_start?: string | null
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created?: string
          current_period_end?: string
          current_period_start?: string
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          price_id?: string | null
          quantity?: number | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          trial_end?: string | null
          trial_start?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: aa_demo_prices
            referencedColumns: ["id"]
          },
        ]
      }
      upsell_subscriptions: {
        Row: {
          business_id: string | null
          canceled_at: string | null
          created_at: string
          discount_percent: number | null
          id: string
          monthly_price: number
          service: Database["public"]["Enums"]["upsell_service"]
          started_at: string | null
          status: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          business_id?: string | null
          canceled_at?: string | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          monthly_price: number
          service: Database["public"]["Enums"]["upsell_service"]
          started_at?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          business_id?: string | null
          canceled_at?: string | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          monthly_price?: number
          service?: Database["public"]["Enums"]["upsell_service"]
          started_at?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: aa_demo_businesses
            referencedColumns: ["id"]
          },
        ]
      }
      user_cache: {
        Row: {
          created_at: string
          email: string
          id: string
          last_sync: string | null
          updated_at: string | null
        }
        Insert: {
          created_at: string
          email: string
          id: string
          last_sync?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_sync?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          billing_address: Json | null
          full_name: string | null
          id: string
          payment_method: Json | null
        }
        Insert: {
          avatar_url?: string | null
          billing_address?: Json | null
          full_name?: string | null
          id: string
          payment_method?: Json | null
        }
        Update: {
          avatar_url?: string | null
          billing_address?: Json | null
          full_name?: string | null
          id?: string
          payment_method?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_stats: { Args: never; Returns: Json }
      get_monthly_edit_count: { Args: { user_uuid: string }; Returns: number }
      has_paid_hosting: { Args: { user_uuid: string }; Returns: boolean }
      is_admin: { Args: { user_uuid: string }; Returns: boolean }
    }
    Enums: {
      asset_status: "pending" | "generating" | "ready" | "approved" | "rejected" | "refreshing"
      asset_type:
        | "logo"
        | "branding_guide"
        | "website_mockup"
        | "color_palette"
        | "font_selection"
      customer_input_type: "file" | "url"
      edit_request_status: "pending" | "in_progress" | "completed" | "rejected"
      migration_job_status: "pending" | "in_progress" | "completed" | "failed"
      migration_page_status:
        | "pending"
        | "rendering"
        | "rewriting"
        | "done"
        | "failed"
      pricing_plan_interval: "day" | "week" | "month" | "year"
      pricing_type: "one_time" | "recurring"
      subscription_status:
        | "trialing"
        | "active"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "past_due"
        | "unpaid"
        | "paused"
      upsell_service: "seo" | "google_ads" | "google_my_business"
      website_status:
        | "building"
        | "deployed"
        | "failed"
        | "suspended"
        | "provisioning"
        | "pending_changes"
        | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_status: ["pending", "generating", "ready", "approved", "rejected", "refreshing"],
      asset_type: [
        "logo",
        "branding_guide",
        "website_mockup",
        "color_palette",
        "font_selection",
      ],
      customer_input_type: ["file", "url"],
      edit_request_status: ["pending", "in_progress", "completed", "rejected"],
      migration_job_status: ["pending", "in_progress", "completed", "failed"],
      migration_page_status: [
        "pending",
        "rendering",
        "rewriting",
        "done",
        "failed",
      ],
      pricing_plan_interval: ["day", "week", "month", "year"],
      pricing_type: ["one_time", "recurring"],
      subscription_status: [
        "trialing",
        "active",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "past_due",
        "unpaid",
        "paused",
      ],
      upsell_service: ["seo", "google_ads", "google_my_business"],
      website_status: [
        "building",
        "deployed",
        "failed",
        "suspended",
        "provisioning",
        "pending_changes",
        "error",
      ],
    },
  },
} as const
