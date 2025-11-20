--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: check_circular_follow(); Type: FUNCTION; Schema: public; Owner: sile
--

CREATE FUNCTION public.check_circular_follow() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Check if reverse follow exists (B→A when inserting A→B)
  IF EXISTS (
    SELECT 1 FROM shop_follows
    WHERE follower_shop_id = NEW.source_shop_id
    AND source_shop_id = NEW.follower_shop_id
    AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Circular follow relationship not allowed: Shop % already follows Shop %',
      NEW.source_shop_id, NEW.follower_shop_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_circular_follow() OWNER TO sile;

--
-- Name: cleanup_old_webhooks(); Type: FUNCTION; Schema: public; Owner: sile
--

CREATE FUNCTION public.cleanup_old_webhooks() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM processed_webhooks
  WHERE processed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_webhooks() OWNER TO sile;

--
-- Name: update_promo_codes_updated_at(); Type: FUNCTION; Schema: public; Owner: sile
--

CREATE FUNCTION public.update_promo_codes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_promo_codes_updated_at() OWNER TO sile;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: sile
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO sile;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    order_id integer,
    chain character varying(20) NOT NULL,
    address character varying(255) NOT NULL,
    address_index integer NOT NULL,
    expected_amount numeric(18,8) NOT NULL,
    currency character varying(10) NOT NULL,
    tatum_subscription_id character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    subscription_id integer,
    crypto_amount numeric(20,8),
    usd_rate numeric(20,2),
    CONSTRAINT check_crypto_amount_positive CHECK (((crypto_amount IS NULL) OR (crypto_amount > (0)::numeric))),
    CONSTRAINT check_invoice_reference CHECK ((((order_id IS NOT NULL) AND (subscription_id IS NULL)) OR ((order_id IS NULL) AND (subscription_id IS NOT NULL)))),
    CONSTRAINT invoices_chain_check CHECK (((chain)::text = ANY ((ARRAY['BTC'::character varying, 'ETH'::character varying, 'LTC'::character varying, 'USDT_TRC20'::character varying])::text[]))),
    CONSTRAINT invoices_expected_amount_check CHECK ((expected_amount > (0)::numeric)),
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.invoices OWNER TO sile;

--
-- Name: TABLE invoices; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.invoices IS 'Payment invoices with unique addresses generated via Tatum';


--
-- Name: COLUMN invoices.chain; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.invoices.chain IS 'Blockchain: BTC, ETH, LTC, USDT_TRC20 (TRON only)';


--
-- Name: COLUMN invoices.address; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.invoices.address IS 'Unique payment address generated from HD wallet';


--
-- Name: COLUMN invoices.address_index; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.invoices.address_index IS 'Derivation index for HD wallet (m/44''/0''/0''/0/{index})';


--
-- Name: COLUMN invoices.expected_amount; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.invoices.expected_amount IS 'Expected payment amount in crypto units';


--
-- Name: COLUMN invoices.tatum_subscription_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.invoices.tatum_subscription_id IS 'Tatum webhook subscription ID for monitoring';


--
-- Name: COLUMN invoices.expires_at; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.invoices.expires_at IS 'Invoice expiration time (typically 1 hour)';


--
-- Name: COLUMN invoices.crypto_amount; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.invoices.crypto_amount IS 'Exact crypto amount to pay (USD converted at creation time)';


--
-- Name: COLUMN invoices.usd_rate; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.invoices.usd_rate IS 'USD exchange rate at invoice creation time (e.g., $100,000 for BTC)';


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.invoices_id_seq OWNER TO sile;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    product_name character varying(255) NOT NULL,
    quantity integer DEFAULT 1,
    price numeric(18,8) NOT NULL,
    currency character varying(10) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT order_items_price_check CHECK ((price > (0)::numeric)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.order_items OWNER TO sile;

--
-- Name: TABLE order_items; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.order_items IS 'Stores individual items in each order';


--
-- Name: COLUMN order_items.product_name; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.order_items.product_name IS 'Cached product name (in case product is deleted)';


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_items_id_seq OWNER TO sile;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    buyer_id integer,
    product_id integer,
    quantity integer DEFAULT 1 NOT NULL,
    total_price numeric(18,8) NOT NULL,
    currency character varying(10) NOT NULL,
    delivery_address character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    paid_at timestamp without time zone,
    completed_at timestamp without time zone,
    CONSTRAINT orders_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT orders_total_price_check CHECK ((total_price > (0)::numeric))
);


ALTER TABLE public.orders OWNER TO sile;

--
-- Name: TABLE orders; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.orders IS 'Stores customer orders';


--
-- Name: COLUMN orders.status; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.orders.status IS 'Order status: pending, confirmed, shipped, delivered, cancelled';


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.orders_id_seq OWNER TO sile;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    order_id integer,
    tx_hash character varying(255) NOT NULL,
    amount numeric(18,8) NOT NULL,
    currency character varying(10) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    confirmations integer DEFAULT 0,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    subscription_id integer,
    CONSTRAINT payments_currency_check CHECK (((currency)::text = ANY ((ARRAY['BTC'::character varying, 'ETH'::character varying, 'USDT'::character varying, 'LTC'::character varying])::text[]))),
    CONSTRAINT payments_order_or_subscription_check CHECK ((((order_id IS NOT NULL) AND (subscription_id IS NULL)) OR ((order_id IS NULL) AND (subscription_id IS NOT NULL)))),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.payments OWNER TO sile;

--
-- Name: TABLE payments; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.payments IS 'Stores crypto payment verification records';


--
-- Name: COLUMN payments.tx_hash; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.payments.tx_hash IS 'Blockchain transaction hash';


--
-- Name: COLUMN payments.confirmations; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.payments.confirmations IS 'Number of blockchain confirmations';


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.payments_id_seq OWNER TO sile;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: processed_webhooks; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.processed_webhooks (
    id integer NOT NULL,
    webhook_id character varying(255) NOT NULL,
    source character varying(50) NOT NULL,
    tx_hash character varying(255) NOT NULL,
    processed_at timestamp without time zone DEFAULT now(),
    payload jsonb,
    CONSTRAINT processed_webhooks_source_check CHECK (((source)::text = ANY ((ARRAY['blockcypher'::character varying, 'etherscan'::character varying, 'trongrid'::character varying])::text[])))
);


ALTER TABLE public.processed_webhooks OWNER TO sile;

--
-- Name: TABLE processed_webhooks; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.processed_webhooks IS 'Webhook deduplication table to prevent replay attacks';


--
-- Name: COLUMN processed_webhooks.webhook_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.processed_webhooks.webhook_id IS 'Unique identifier from webhook (tx_hash + source)';


--
-- Name: COLUMN processed_webhooks.source; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.processed_webhooks.source IS 'Webhook source: blockcypher, etherscan, trongrid';


--
-- Name: COLUMN processed_webhooks.tx_hash; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.processed_webhooks.tx_hash IS 'Transaction hash from blockchain';


--
-- Name: processed_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.processed_webhooks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.processed_webhooks_id_seq OWNER TO sile;

--
-- Name: processed_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.processed_webhooks_id_seq OWNED BY public.processed_webhooks.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.products (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(18,8) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    stock_quantity integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    reserved_quantity integer DEFAULT 0,
    discount_percentage numeric(5,2) DEFAULT 0,
    original_price numeric(18,8),
    discount_expires_at timestamp without time zone,
    is_preorder boolean DEFAULT false NOT NULL,
    CONSTRAINT check_available_stock CHECK ((stock_quantity >= reserved_quantity)),
    CONSTRAINT check_reserved_quantity CHECK ((stock_quantity >= reserved_quantity)),
    CONSTRAINT products_discount_percentage_check CHECK (((discount_percentage >= (0)::numeric) AND (discount_percentage <= (100)::numeric))),
    CONSTRAINT products_price_check CHECK ((price > (0)::numeric)),
    CONSTRAINT products_reserved_quantity_check CHECK ((reserved_quantity >= 0)),
    CONSTRAINT products_stock_quantity_check CHECK ((stock_quantity >= 0))
);


ALTER TABLE public.products OWNER TO sile;

--
-- Name: TABLE products; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.products IS 'Stores products for each shop';


--
-- Name: COLUMN products.price; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.products.price IS 'Product price in USD (8 decimal precision)';


--
-- Name: COLUMN products.currency; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.products.currency IS 'Legacy field - products are priced in USD only';


--
-- Name: COLUMN products.stock_quantity; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.products.stock_quantity IS 'Available stock quantity';


--
-- Name: COLUMN products.reserved_quantity; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.products.reserved_quantity IS 'Quantity reserved by unpaid orders. Available stock = stock_quantity - reserved_quantity';


--
-- Name: COLUMN products.discount_percentage; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.products.discount_percentage IS 'Discount percentage (0-100). 0 = no discount';


--
-- Name: COLUMN products.original_price; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.products.original_price IS 'Original price before discount. NULL if no discount applied';


--
-- Name: COLUMN products.discount_expires_at; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.products.discount_expires_at IS 'When discount expires. NULL = permanent discount';


--
-- Name: COLUMN products.is_preorder; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.products.is_preorder IS 'Indicates if product is available for preorder only (not in stock yet)';


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.products_id_seq OWNER TO sile;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: products_with_availability; Type: VIEW; Schema: public; Owner: sile
--

CREATE VIEW public.products_with_availability AS
 SELECT p.id,
    p.shop_id,
    p.name,
    p.description,
    p.price,
    p.currency,
    p.stock_quantity,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.reserved_quantity,
    (p.stock_quantity - p.reserved_quantity) AS available_quantity
   FROM public.products p;


ALTER TABLE public.products_with_availability OWNER TO sile;

--
-- Name: VIEW products_with_availability; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON VIEW public.products_with_availability IS 'Convenience view showing products with calculated available_quantity field';


--
-- Name: promo_activations; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.promo_activations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    shop_id integer NOT NULL,
    promo_code character varying(50) NOT NULL,
    activated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.promo_activations OWNER TO sile;

--
-- Name: TABLE promo_activations; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.promo_activations IS 'Tracks promo code activations to prevent duplicate usage';


--
-- Name: COLUMN promo_activations.user_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_activations.user_id IS 'User who activated the promo code';


--
-- Name: COLUMN promo_activations.shop_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_activations.shop_id IS 'Shop created with promo code';


--
-- Name: COLUMN promo_activations.promo_code; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_activations.promo_code IS 'Promo code used (e.g., comi9999)';


--
-- Name: promo_activations_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.promo_activations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.promo_activations_id_seq OWNER TO sile;

--
-- Name: promo_activations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.promo_activations_id_seq OWNED BY public.promo_activations.id;


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.promo_codes (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    discount_percentage numeric(5,2) NOT NULL,
    tier character varying(10) NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT check_max_uses CHECK (((max_uses IS NULL) OR (max_uses > 0))),
    CONSTRAINT check_used_count_limit CHECK (((max_uses IS NULL) OR (used_count <= max_uses))),
    CONSTRAINT promo_codes_discount_percentage_check CHECK (((discount_percentage >= (0)::numeric) AND (discount_percentage <= (100)::numeric))),
    CONSTRAINT promo_codes_tier_check CHECK (((tier)::text = ANY ((ARRAY['basic'::character varying, 'pro'::character varying])::text[]))),
    CONSTRAINT promo_codes_used_count_check CHECK ((used_count >= 0))
);


ALTER TABLE public.promo_codes OWNER TO sile;

--
-- Name: TABLE promo_codes; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.promo_codes IS 'Database-driven promo codes for subscription discounts';


--
-- Name: COLUMN promo_codes.code; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_codes.code IS 'Promo code string (case-insensitive)';


--
-- Name: COLUMN promo_codes.discount_percentage; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_codes.discount_percentage IS 'Discount percentage (0-100)';


--
-- Name: COLUMN promo_codes.tier; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_codes.tier IS 'Which tier this promo applies to: basic or pro';


--
-- Name: COLUMN promo_codes.max_uses; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_codes.max_uses IS 'Maximum number of uses. NULL = unlimited';


--
-- Name: COLUMN promo_codes.used_count; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_codes.used_count IS 'Current usage count';


--
-- Name: COLUMN promo_codes.expires_at; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_codes.expires_at IS 'Expiration timestamp. NULL = never expires';


--
-- Name: COLUMN promo_codes.is_active; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.promo_codes.is_active IS 'Whether promo code is currently active';


--
-- Name: promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.promo_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.promo_codes_id_seq OWNER TO sile;

--
-- Name: promo_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.promo_codes_id_seq OWNED BY public.promo_codes.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.schema_migrations (
    version integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.schema_migrations OWNER TO sile;

--
-- Name: shop_follows; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.shop_follows (
    id integer NOT NULL,
    follower_shop_id integer NOT NULL,
    source_shop_id integer NOT NULL,
    mode character varying(20) NOT NULL,
    markup_percentage numeric(5,2) DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT shop_follows_check CHECK ((follower_shop_id <> source_shop_id)),
    CONSTRAINT shop_follows_markup_percentage_check CHECK (((markup_percentage >= (0)::numeric) AND (markup_percentage <= (500)::numeric))),
    CONSTRAINT shop_follows_mode_check CHECK (((mode)::text = ANY ((ARRAY['monitor'::character varying, 'resell'::character varying])::text[]))),
    CONSTRAINT shop_follows_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.shop_follows OWNER TO sile;

--
-- Name: TABLE shop_follows; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.shop_follows IS 'Tracks follower→source shop relationships for dropshipping/reseller functionality';


--
-- Name: COLUMN shop_follows.mode; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_follows.mode IS 'monitor: just watch, resell: auto-copy with markup';


--
-- Name: COLUMN shop_follows.markup_percentage; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_follows.markup_percentage IS 'Markup percentage for resell mode (1-500%)';


--
-- Name: shop_follows_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.shop_follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shop_follows_id_seq OWNER TO sile;

--
-- Name: shop_follows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.shop_follows_id_seq OWNED BY public.shop_follows.id;


--
-- Name: shop_payments; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.shop_payments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    shop_id integer,
    amount numeric(18,8) NOT NULL,
    currency character varying(10) NOT NULL,
    payment_hash character varying(255),
    payment_address character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    verified_at timestamp without time zone,
    CONSTRAINT shop_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT shop_payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.shop_payments OWNER TO sile;

--
-- Name: TABLE shop_payments; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.shop_payments IS 'Stores $25 payments for shop activation';


--
-- Name: COLUMN shop_payments.status; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_payments.status IS 'Payment status: pending, confirmed, failed';


--
-- Name: shop_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.shop_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shop_payments_id_seq OWNER TO sile;

--
-- Name: shop_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.shop_payments_id_seq OWNED BY public.shop_payments.id;


--
-- Name: shop_subscriptions; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.shop_subscriptions (
    id integer NOT NULL,
    shop_id integer,
    tier character varying(20) NOT NULL,
    amount numeric(10,2) NOT NULL,
    tx_hash character varying(255) NOT NULL,
    currency character varying(10) NOT NULL,
    period_start timestamp without time zone NOT NULL,
    period_end timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    verified_at timestamp without time zone,
    user_id integer NOT NULL,
    CONSTRAINT check_subscription_period CHECK ((period_end > period_start)),
    CONSTRAINT shop_subscriptions_currency_check CHECK (((currency)::text = ANY ((ARRAY['BTC'::character varying, 'ETH'::character varying, 'USDT'::character varying, 'LTC'::character varying])::text[]))),
    CONSTRAINT shop_subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'paid'::character varying])::text[]))),
    CONSTRAINT shop_subscriptions_tier_check CHECK (((tier)::text = ANY ((ARRAY['basic'::character varying, 'pro'::character varying])::text[])))
);


ALTER TABLE public.shop_subscriptions OWNER TO sile;

--
-- Name: COLUMN shop_subscriptions.shop_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_subscriptions.shop_id IS 'Shop associated with subscription (NULL until payment confirmed)';


--
-- Name: COLUMN shop_subscriptions.status; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_subscriptions.status IS 'pending: awaiting confirmation, active: valid, expired: period ended, cancelled: refunded';


--
-- Name: COLUMN shop_subscriptions.user_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_subscriptions.user_id IS 'User who created subscription (before shop is created)';


--
-- Name: shop_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.shop_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shop_subscriptions_id_seq OWNER TO sile;

--
-- Name: shop_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.shop_subscriptions_id_seq OWNED BY public.shop_subscriptions.id;


--
-- Name: shop_workers; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.shop_workers (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    worker_user_id integer NOT NULL,
    telegram_id bigint NOT NULL,
    added_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shop_workers OWNER TO sile;

--
-- Name: TABLE shop_workers; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.shop_workers IS 'Shop workspace members - employees who can manage products';


--
-- Name: COLUMN shop_workers.worker_user_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_workers.worker_user_id IS 'User ID of the worker';


--
-- Name: COLUMN shop_workers.telegram_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_workers.telegram_id IS 'Telegram ID for search/display';


--
-- Name: COLUMN shop_workers.added_by; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shop_workers.added_by IS 'Shop owner who added this worker';


--
-- Name: shop_workers_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.shop_workers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shop_workers_id_seq OWNER TO sile;

--
-- Name: shop_workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.shop_workers_id_seq OWNED BY public.shop_workers.id;


--
-- Name: shops; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.shops (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    registration_paid boolean DEFAULT false,
    name character varying(255) NOT NULL,
    description text,
    logo text,
    wallet_btc character varying(255),
    wallet_eth character varying(255),
    wallet_usdt character varying(255),
    wallet_ltc character varying(255),
    tier character varying(20) DEFAULT 'basic'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    subscription_status character varying(20) DEFAULT 'active'::character varying,
    next_payment_due timestamp without time zone,
    grace_period_until timestamp without time zone,
    channel_url character varying(255),
    CONSTRAINT shops_subscription_status_check CHECK (((subscription_status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'grace_period'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT shops_tier_check CHECK (((tier)::text = ANY ((ARRAY['basic'::character varying, 'pro'::character varying])::text[])))
);


ALTER TABLE public.shops OWNER TO sile;

--
-- Name: TABLE shops; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.shops IS 'Stores shops - any user with a shop becomes a seller';


--
-- Name: COLUMN shops.owner_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shops.owner_id IS 'Reference to shop owner (user becomes seller by creating shop)';


--
-- Name: COLUMN shops.registration_paid; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shops.registration_paid IS 'Whether $25 registration payment was confirmed';


--
-- Name: COLUMN shops.wallet_ltc; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shops.wallet_ltc IS 'Litecoin wallet address for receiving payments';


--
-- Name: COLUMN shops.is_active; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shops.is_active IS 'Shop activation status';


--
-- Name: COLUMN shops.channel_url; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.shops.channel_url IS 'Telegram channel URL for shop notifications (format: @channel_name or https://t.me/channel_name)';


--
-- Name: shops_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.shops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shops_id_seq OWNER TO sile;

--
-- Name: shops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.shops_id_seq OWNED BY public.shops.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    shop_id integer NOT NULL,
    telegram_id bigint,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO sile;

--
-- Name: TABLE subscriptions; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.subscriptions IS 'Stores user subscriptions to shops for notifications';


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.subscriptions_id_seq OWNER TO sile;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: synced_products; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.synced_products (
    id integer NOT NULL,
    follow_id integer NOT NULL,
    synced_product_id integer NOT NULL,
    source_product_id integer NOT NULL,
    last_synced_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    conflict_status character varying(20) DEFAULT 'synced'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT synced_products_check CHECK ((synced_product_id <> source_product_id)),
    CONSTRAINT synced_products_conflict_status_check CHECK (((conflict_status)::text = ANY ((ARRAY['synced'::character varying, 'conflict'::character varying, 'manual_override'::character varying])::text[])))
);


ALTER TABLE public.synced_products OWNER TO sile;

--
-- Name: TABLE synced_products; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.synced_products IS 'Tracks synced products between follower and source shops';


--
-- Name: COLUMN synced_products.conflict_status; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.synced_products.conflict_status IS 'synced: in sync, conflict: manual edits detected, manual_override: user kept manual edits';


--
-- Name: synced_products_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.synced_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.synced_products_id_seq OWNER TO sile;

--
-- Name: synced_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.synced_products_id_seq OWNED BY public.synced_products.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: sile
--

CREATE TABLE public.users (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    username character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    selected_role character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    wallet_ltc character varying(100),
    CONSTRAINT users_selected_role_check CHECK (((selected_role)::text = ANY ((ARRAY['buyer'::character varying, 'seller'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO sile;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON TABLE public.users IS 'Stores all platform users';


--
-- Name: COLUMN users.telegram_id; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON COLUMN public.users.telegram_id IS 'Unique Telegram user ID';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO sile;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sile
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wallet_address_index_btc; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.wallet_address_index_btc
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.wallet_address_index_btc OWNER TO sile;

--
-- Name: SEQUENCE wallet_address_index_btc; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON SEQUENCE public.wallet_address_index_btc IS 'Atomic counter for BTC wallet address derivation index';


--
-- Name: wallet_address_index_eth; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.wallet_address_index_eth
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.wallet_address_index_eth OWNER TO sile;

--
-- Name: SEQUENCE wallet_address_index_eth; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON SEQUENCE public.wallet_address_index_eth IS 'Atomic counter for ETH wallet address derivation index';


--
-- Name: wallet_address_index_ltc; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.wallet_address_index_ltc
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.wallet_address_index_ltc OWNER TO sile;

--
-- Name: SEQUENCE wallet_address_index_ltc; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON SEQUENCE public.wallet_address_index_ltc IS 'Atomic counter for LTC wallet address derivation index';


--
-- Name: wallet_address_index_usdt_trc20; Type: SEQUENCE; Schema: public; Owner: sile
--

CREATE SEQUENCE public.wallet_address_index_usdt_trc20
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.wallet_address_index_usdt_trc20 OWNER TO sile;

--
-- Name: SEQUENCE wallet_address_index_usdt_trc20; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON SEQUENCE public.wallet_address_index_usdt_trc20 IS 'Atomic counter for USDT (TRC-20) wallet address derivation index';


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: processed_webhooks id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.processed_webhooks ALTER COLUMN id SET DEFAULT nextval('public.processed_webhooks_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: promo_activations id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.promo_activations ALTER COLUMN id SET DEFAULT nextval('public.promo_activations_id_seq'::regclass);


--
-- Name: promo_codes id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.promo_codes ALTER COLUMN id SET DEFAULT nextval('public.promo_codes_id_seq'::regclass);


--
-- Name: shop_follows id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_follows ALTER COLUMN id SET DEFAULT nextval('public.shop_follows_id_seq'::regclass);


--
-- Name: shop_payments id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_payments ALTER COLUMN id SET DEFAULT nextval('public.shop_payments_id_seq'::regclass);


--
-- Name: shop_subscriptions id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.shop_subscriptions_id_seq'::regclass);


--
-- Name: shop_workers id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_workers ALTER COLUMN id SET DEFAULT nextval('public.shop_workers_id_seq'::regclass);


--
-- Name: shops id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shops ALTER COLUMN id SET DEFAULT nextval('public.shops_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: synced_products id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.synced_products ALTER COLUMN id SET DEFAULT nextval('public.synced_products_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.invoices (id, order_id, chain, address, address_index, expected_amount, currency, tatum_subscription_id, status, expires_at, created_at, updated_at, subscription_id, crypto_amount, usd_rate) FROM stdin;
25	\N	LTC	Lb6QvL6EwvsUbBmncMwcg1BJhyXhVFzLn4	20	1.00000000	LTC	859097f2-4dca-4cb8-b6c3-43cf59d1c0f9	paid	2025-11-15 19:45:59.104	2025-11-15 19:15:59.790775	2025-11-15 19:16:33.947513	26	0.00963112	103.83
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.order_items (id, order_id, product_id, product_name, quantity, price, currency, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.orders (id, buyer_id, product_id, quantity, total_price, currency, delivery_address, status, created_at, updated_at, paid_at, completed_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.payments (id, order_id, tx_hash, amount, currency, status, confirmations, verified_at, created_at, updated_at, subscription_id) FROM stdin;
24	\N	fbba08231d5d65b04ca4e713516544afd4bd0dcb0ef6aa6edea6dd6831453c18	0.00962995	LTC	pending	0	\N	2025-11-15 19:16:33.935633	2025-11-15 19:16:33.940213	26
\.


--
-- Data for Name: processed_webhooks; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.processed_webhooks (id, webhook_id, source, tx_hash, processed_at, payload) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.products (id, shop_id, name, description, price, currency, stock_quantity, is_active, created_at, updated_at, reserved_quantity, discount_percentage, original_price, discount_expires_at, is_preorder) FROM stdin;
\.


--
-- Data for Name: promo_activations; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.promo_activations (id, user_id, shop_id, promo_code, activated_at) FROM stdin;
\.


--
-- Data for Name: promo_codes; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.promo_codes (id, code, discount_percentage, tier, max_uses, used_count, expires_at, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.schema_migrations (version, name, applied_at) FROM stdin;
16	add_crypto_amount_to_invoices	2025-11-01 19:38:21.642182
17	add_user_id_to_shop_subscriptions	2025-11-01 20:18:08.574655
\.


--
-- Data for Name: shop_follows; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.shop_follows (id, follower_shop_id, source_shop_id, mode, markup_percentage, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shop_payments; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.shop_payments (id, user_id, shop_id, amount, currency, payment_hash, payment_address, status, created_at, verified_at) FROM stdin;
\.


--
-- Data for Name: shop_subscriptions; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.shop_subscriptions (id, shop_id, tier, amount, tx_hash, currency, period_start, period_end, status, created_at, verified_at, user_id) FROM stdin;
26	\N	pro	35.00	pending-2-1763223355936	USDT	2025-11-15 19:15:55.936	2025-12-15 19:15:55.936	pending	2025-11-15 19:15:55.934953	\N	2
\.


--
-- Data for Name: shop_workers; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.shop_workers (id, shop_id, worker_user_id, telegram_id, added_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shops; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.shops (id, owner_id, registration_paid, name, description, logo, wallet_btc, wallet_eth, wallet_usdt, wallet_ltc, tier, is_active, created_at, updated_at, subscription_status, next_payment_due, grace_period_until, channel_url) FROM stdin;
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.subscriptions (id, user_id, shop_id, telegram_id, created_at) FROM stdin;
\.


--
-- Data for Name: synced_products; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.synced_products (id, follow_id, synced_product_id, source_product_id, last_synced_at, conflict_status, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: sile
--

COPY public.users (id, telegram_id, username, first_name, last_name, selected_role, created_at, updated_at, wallet_ltc) FROM stdin;
3	1479666461	KPonedelnikova	Ксения		\N	2025-11-10 11:29:21.245865	2025-11-10 11:29:21.245865	\N
204	6744539440	\N	Outcast		seller	2025-11-12 16:39:22.702634	2025-11-12 16:39:33.563064	\N
205	1887391462	\N	ZIDANE		seller	2025-11-13 01:30:02.287667	2025-11-13 01:30:05.135715	\N
206	6298213140	OgswarmLA7	Og	Swarm	seller	2025-11-13 01:57:44.218625	2025-11-13 01:57:47.827556	\N
207	586474013	fiqkyy	.		\N	2025-11-13 16:19:32.958726	2025-11-13 16:19:32.958726	\N
208	571227567	\N	AMIR MATIN	Mohammadzadeh	buyer	2025-11-14 12:47:15.165519	2025-11-14 12:47:19.39247	\N
2	1997815787	Sithil15	Fred Matthew Brown		seller	2025-11-10 10:47:35.879858	2025-11-15 19:15:49.195872	\N
139	424677	testuser1	Test	User1	\N	2025-11-10 21:30:43.150798	2025-11-10 21:30:43.150798	\N
140	9867	testuser2	Test	User2	\N	2025-11-10 21:30:43.153289	2025-11-10 21:30:43.153289	\N
177	469954	validationuser	Validation	Test	\N	2025-11-10 21:30:44.50522	2025-11-10 21:30:44.50522	\N
190	732911	ratelimituser	Rate	Limit	\N	2025-11-10 21:30:46.568603	2025-11-10 21:30:46.568603	\N
\.


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.invoices_id_seq', 25, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.order_items_id_seq', 1, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.orders_id_seq', 4, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.payments_id_seq', 24, true);


--
-- Name: processed_webhooks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.processed_webhooks_id_seq', 1, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.products_id_seq', 56, true);


--
-- Name: promo_activations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.promo_activations_id_seq', 1, false);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.promo_codes_id_seq', 1, false);


--
-- Name: shop_follows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.shop_follows_id_seq', 30, true);


--
-- Name: shop_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.shop_payments_id_seq', 1, false);


--
-- Name: shop_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.shop_subscriptions_id_seq', 26, true);


--
-- Name: shop_workers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.shop_workers_id_seq', 24, true);


--
-- Name: shops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.shops_id_seq', 179, true);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.subscriptions_id_seq', 1, false);


--
-- Name: synced_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.synced_products_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.users_id_seq', 208, true);


--
-- Name: wallet_address_index_btc; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.wallet_address_index_btc', 7, true);


--
-- Name: wallet_address_index_eth; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.wallet_address_index_eth', 2, true);


--
-- Name: wallet_address_index_ltc; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.wallet_address_index_ltc', 20, true);


--
-- Name: wallet_address_index_usdt_trc20; Type: SEQUENCE SET; Schema: public; Owner: sile
--

SELECT pg_catalog.setval('public.wallet_address_index_usdt_trc20', 1, true);


--
-- Name: invoices invoices_address_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_address_key UNIQUE (address);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_tx_hash_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_tx_hash_key UNIQUE (tx_hash);


--
-- Name: processed_webhooks processed_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.processed_webhooks
    ADD CONSTRAINT processed_webhooks_pkey PRIMARY KEY (id);


--
-- Name: processed_webhooks processed_webhooks_webhook_id_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.processed_webhooks
    ADD CONSTRAINT processed_webhooks_webhook_id_key UNIQUE (webhook_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: promo_activations promo_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.promo_activations
    ADD CONSTRAINT promo_activations_pkey PRIMARY KEY (id);


--
-- Name: promo_activations promo_activations_user_id_promo_code_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.promo_activations
    ADD CONSTRAINT promo_activations_user_id_promo_code_key UNIQUE (user_id, promo_code);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: shop_follows shop_follows_follower_shop_id_source_shop_id_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_follows
    ADD CONSTRAINT shop_follows_follower_shop_id_source_shop_id_key UNIQUE (follower_shop_id, source_shop_id);


--
-- Name: shop_follows shop_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_follows
    ADD CONSTRAINT shop_follows_pkey PRIMARY KEY (id);


--
-- Name: shop_payments shop_payments_payment_hash_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_payments
    ADD CONSTRAINT shop_payments_payment_hash_key UNIQUE (payment_hash);


--
-- Name: shop_payments shop_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_payments
    ADD CONSTRAINT shop_payments_pkey PRIMARY KEY (id);


--
-- Name: shop_subscriptions shop_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_subscriptions
    ADD CONSTRAINT shop_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: shop_subscriptions shop_subscriptions_tx_hash_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_subscriptions
    ADD CONSTRAINT shop_subscriptions_tx_hash_key UNIQUE (tx_hash);


--
-- Name: shop_workers shop_workers_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_workers
    ADD CONSTRAINT shop_workers_pkey PRIMARY KEY (id);


--
-- Name: shop_workers shop_workers_shop_id_worker_user_id_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_workers
    ADD CONSTRAINT shop_workers_shop_id_worker_user_id_key UNIQUE (shop_id, worker_user_id);


--
-- Name: shops shops_name_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_name_key UNIQUE (name);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);


--
-- Name: shops shops_wallet_btc_unique; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_wallet_btc_unique UNIQUE (wallet_btc);


--
-- Name: shops shops_wallet_eth_unique; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_wallet_eth_unique UNIQUE (wallet_eth);


--
-- Name: shops shops_wallet_ltc_unique; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_wallet_ltc_unique UNIQUE (wallet_ltc);


--
-- Name: shops shops_wallet_usdt_unique; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_wallet_usdt_unique UNIQUE (wallet_usdt);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_id_shop_id_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_shop_id_key UNIQUE (user_id, shop_id);


--
-- Name: synced_products synced_products_follow_id_source_product_id_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.synced_products
    ADD CONSTRAINT synced_products_follow_id_source_product_id_key UNIQUE (follow_id, source_product_id);


--
-- Name: synced_products synced_products_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.synced_products
    ADD CONSTRAINT synced_products_pkey PRIMARY KEY (id);


--
-- Name: synced_products synced_products_synced_product_id_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.synced_products
    ADD CONSTRAINT synced_products_synced_product_id_key UNIQUE (synced_product_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_key UNIQUE (telegram_id);


--
-- Name: idx_invoices_address; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_invoices_address ON public.invoices USING btree (address);


--
-- Name: idx_invoices_chain; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_invoices_chain ON public.invoices USING btree (chain);


--
-- Name: idx_invoices_expires_at; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_invoices_expires_at ON public.invoices USING btree (expires_at);


--
-- Name: idx_invoices_order; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_invoices_order ON public.invoices USING btree (order_id);


--
-- Name: idx_invoices_order_subscription; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_invoices_order_subscription ON public.invoices USING btree (order_id, subscription_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_invoices_status_expires; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_invoices_status_expires ON public.invoices USING btree (status, expires_at);


--
-- Name: idx_invoices_subscription_id; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_invoices_subscription_id ON public.invoices USING btree (subscription_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_orders_buyer; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_orders_buyer ON public.orders USING btree (buyer_id);


--
-- Name: idx_orders_buyer_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_orders_buyer_status ON public.orders USING btree (buyer_id, status);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_product; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_orders_product ON public.orders USING btree (product_id);


--
-- Name: idx_orders_product_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_orders_product_status ON public.orders USING btree (product_id, status);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_status_created; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_orders_status_created ON public.orders USING btree (status, created_at DESC);


--
-- Name: idx_payments_created_at; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at DESC);


--
-- Name: idx_payments_order_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_payments_order_status ON public.payments USING btree (order_id, status);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_subscription; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_payments_subscription ON public.payments USING btree (subscription_id);


--
-- Name: idx_processed_webhooks_processed_at; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_processed_webhooks_processed_at ON public.processed_webhooks USING btree (processed_at);


--
-- Name: idx_processed_webhooks_tx_hash; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_processed_webhooks_tx_hash ON public.processed_webhooks USING btree (tx_hash);


--
-- Name: idx_processed_webhooks_webhook_id; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_processed_webhooks_webhook_id ON public.processed_webhooks USING btree (webhook_id);


--
-- Name: idx_products_availability; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_products_availability ON public.products USING btree (id, stock_quantity, reserved_quantity) WHERE (is_active = true);


--
-- Name: idx_products_discount_active; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_products_discount_active ON public.products USING btree (shop_id, discount_percentage, discount_expires_at) WHERE (discount_percentage > (0)::numeric);


--
-- Name: idx_products_preorder; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_products_preorder ON public.products USING btree (shop_id, is_preorder) WHERE (is_preorder = true);


--
-- Name: idx_products_shop; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_products_shop ON public.products USING btree (shop_id);


--
-- Name: idx_products_shop_active; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_products_shop_active ON public.products USING btree (shop_id, is_active);


--
-- Name: idx_products_updated_at; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_products_updated_at ON public.products USING btree (updated_at);


--
-- Name: idx_promo_activations_code; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_promo_activations_code ON public.promo_activations USING btree (promo_code);


--
-- Name: idx_promo_activations_shop; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_promo_activations_shop ON public.promo_activations USING btree (shop_id);


--
-- Name: idx_promo_activations_user; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_promo_activations_user ON public.promo_activations USING btree (user_id);


--
-- Name: idx_promo_activations_user_promo; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_promo_activations_user_promo ON public.promo_activations USING btree (user_id, promo_code);


--
-- Name: idx_promo_codes_active; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_promo_codes_active ON public.promo_codes USING btree (is_active, expires_at);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code) WHERE (is_active = true);


--
-- Name: idx_shop_follows_created_at; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_follows_created_at ON public.shop_follows USING btree (created_at DESC);


--
-- Name: idx_shop_follows_follower; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_follows_follower ON public.shop_follows USING btree (follower_shop_id);


--
-- Name: idx_shop_follows_follower_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_follows_follower_status ON public.shop_follows USING btree (follower_shop_id, status);


--
-- Name: idx_shop_follows_mode; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_follows_mode ON public.shop_follows USING btree (mode);


--
-- Name: idx_shop_follows_source; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_follows_source ON public.shop_follows USING btree (source_shop_id);


--
-- Name: idx_shop_follows_source_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_follows_source_status ON public.shop_follows USING btree (source_shop_id, status);


--
-- Name: idx_shop_follows_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_follows_status ON public.shop_follows USING btree (status);


--
-- Name: idx_shop_subscriptions_shop_id; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_subscriptions_shop_id ON public.shop_subscriptions USING btree (shop_id);


--
-- Name: idx_shop_subscriptions_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_subscriptions_status ON public.shop_subscriptions USING btree (status);


--
-- Name: idx_shop_subscriptions_user_id; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_subscriptions_user_id ON public.shop_subscriptions USING btree (user_id);


--
-- Name: idx_shop_subscriptions_user_shop; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_subscriptions_user_shop ON public.shop_subscriptions USING btree (user_id, shop_id);


--
-- Name: idx_shop_workers_composite; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_workers_composite ON public.shop_workers USING btree (shop_id, worker_user_id);


--
-- Name: idx_shop_workers_shop; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_workers_shop ON public.shop_workers USING btree (shop_id);


--
-- Name: idx_shop_workers_telegram; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_workers_telegram ON public.shop_workers USING btree (telegram_id);


--
-- Name: idx_shop_workers_worker; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shop_workers_worker ON public.shop_workers USING btree (worker_user_id);


--
-- Name: idx_shops_channel_url; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_channel_url ON public.shops USING btree (channel_url);


--
-- Name: idx_shops_next_payment_due; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_next_payment_due ON public.shops USING btree (next_payment_due);


--
-- Name: idx_shops_owner; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_owner ON public.shops USING btree (owner_id);


--
-- Name: idx_shops_subscription_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_subscription_status ON public.shops USING btree (subscription_status);


--
-- Name: idx_shops_tier; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_tier ON public.shops USING btree (tier);


--
-- Name: idx_shops_wallet_btc; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_wallet_btc ON public.shops USING btree (wallet_btc) WHERE (wallet_btc IS NOT NULL);


--
-- Name: idx_shops_wallet_btc_unique; Type: INDEX; Schema: public; Owner: sile
--

CREATE UNIQUE INDEX idx_shops_wallet_btc_unique ON public.shops USING btree (wallet_btc) WHERE (wallet_btc IS NOT NULL);


--
-- Name: INDEX idx_shops_wallet_btc_unique; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON INDEX public.idx_shops_wallet_btc_unique IS 'Ensures Bitcoin wallet addresses are unique across all shops (prevents payment routing conflicts)';


--
-- Name: idx_shops_wallet_eth; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_wallet_eth ON public.shops USING btree (wallet_eth) WHERE (wallet_eth IS NOT NULL);


--
-- Name: idx_shops_wallet_eth_unique; Type: INDEX; Schema: public; Owner: sile
--

CREATE UNIQUE INDEX idx_shops_wallet_eth_unique ON public.shops USING btree (wallet_eth) WHERE (wallet_eth IS NOT NULL);


--
-- Name: INDEX idx_shops_wallet_eth_unique; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON INDEX public.idx_shops_wallet_eth_unique IS 'Ensures Ethereum wallet addresses are unique across all shops (prevents payment routing conflicts)';


--
-- Name: idx_shops_wallet_ltc; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_wallet_ltc ON public.shops USING btree (wallet_ltc) WHERE (wallet_ltc IS NOT NULL);


--
-- Name: idx_shops_wallet_ltc_unique; Type: INDEX; Schema: public; Owner: sile
--

CREATE UNIQUE INDEX idx_shops_wallet_ltc_unique ON public.shops USING btree (wallet_ltc) WHERE (wallet_ltc IS NOT NULL);


--
-- Name: INDEX idx_shops_wallet_ltc_unique; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON INDEX public.idx_shops_wallet_ltc_unique IS 'Ensures Litecoin wallet addresses are unique across all shops (prevents payment routing conflicts)';


--
-- Name: idx_shops_wallet_usdt; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_shops_wallet_usdt ON public.shops USING btree (wallet_usdt) WHERE (wallet_usdt IS NOT NULL);


--
-- Name: idx_shops_wallet_usdt_unique; Type: INDEX; Schema: public; Owner: sile
--

CREATE UNIQUE INDEX idx_shops_wallet_usdt_unique ON public.shops USING btree (wallet_usdt) WHERE (wallet_usdt IS NOT NULL);


--
-- Name: INDEX idx_shops_wallet_usdt_unique; Type: COMMENT; Schema: public; Owner: sile
--

COMMENT ON INDEX public.idx_shops_wallet_usdt_unique IS 'Ensures USDT wallet addresses are unique across all shops (prevents payment routing conflicts)';


--
-- Name: idx_subscriptions_shop; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_subscriptions_shop ON public.subscriptions USING btree (shop_id);


--
-- Name: idx_subscriptions_telegram_id; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_subscriptions_telegram_id ON public.subscriptions USING btree (telegram_id);


--
-- Name: idx_subscriptions_user; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);


--
-- Name: idx_synced_products_conflict; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_synced_products_conflict ON public.synced_products USING btree (conflict_status);


--
-- Name: idx_synced_products_follow; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_synced_products_follow ON public.synced_products USING btree (follow_id);


--
-- Name: idx_synced_products_follow_status; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_synced_products_follow_status ON public.synced_products USING btree (follow_id, conflict_status);


--
-- Name: idx_synced_products_last_synced; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_synced_products_last_synced ON public.synced_products USING btree (last_synced_at);


--
-- Name: idx_synced_products_source; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_synced_products_source ON public.synced_products USING btree (source_product_id);


--
-- Name: idx_synced_products_synced; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_synced_products_synced ON public.synced_products USING btree (synced_product_id);


--
-- Name: idx_users_selected_role; Type: INDEX; Schema: public; Owner: sile
--

CREATE INDEX idx_users_selected_role ON public.users USING btree (selected_role);


--
-- Name: shop_follows prevent_circular_follows; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER prevent_circular_follows BEFORE INSERT OR UPDATE ON public.shop_follows FOR EACH ROW EXECUTE FUNCTION public.check_circular_follow();


--
-- Name: promo_codes trigger_update_promo_codes_updated_at; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER trigger_update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_promo_codes_updated_at();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shop_workers update_shop_workers_updated_at; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER update_shop_workers_updated_at BEFORE UPDATE ON public.shop_workers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shops update_shops_updated_at; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: sile
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.shop_subscriptions(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: orders orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: payments payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.shop_subscriptions(id) ON DELETE CASCADE;


--
-- Name: products products_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: promo_activations promo_activations_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.promo_activations
    ADD CONSTRAINT promo_activations_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: promo_activations promo_activations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.promo_activations
    ADD CONSTRAINT promo_activations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shop_follows shop_follows_follower_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_follows
    ADD CONSTRAINT shop_follows_follower_shop_id_fkey FOREIGN KEY (follower_shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: shop_follows shop_follows_source_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_follows
    ADD CONSTRAINT shop_follows_source_shop_id_fkey FOREIGN KEY (source_shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: shop_subscriptions shop_subscriptions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_subscriptions
    ADD CONSTRAINT shop_subscriptions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: shop_subscriptions shop_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_subscriptions
    ADD CONSTRAINT shop_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shop_workers shop_workers_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_workers
    ADD CONSTRAINT shop_workers_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shop_workers shop_workers_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_workers
    ADD CONSTRAINT shop_workers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: shop_workers shop_workers_worker_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shop_workers
    ADD CONSTRAINT shop_workers_worker_user_id_fkey FOREIGN KEY (worker_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shops shops_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: synced_products synced_products_follow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.synced_products
    ADD CONSTRAINT synced_products_follow_id_fkey FOREIGN KEY (follow_id) REFERENCES public.shop_follows(id) ON DELETE CASCADE;


--
-- Name: synced_products synced_products_source_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.synced_products
    ADD CONSTRAINT synced_products_source_product_id_fkey FOREIGN KEY (source_product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: synced_products synced_products_synced_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sile
--

ALTER TABLE ONLY public.synced_products
    ADD CONSTRAINT synced_products_synced_product_id_fkey FOREIGN KEY (synced_product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

