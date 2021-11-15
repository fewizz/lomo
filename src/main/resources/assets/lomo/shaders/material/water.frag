#include frex:shaders/api/fragment.glsl
#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/lib/noise/noise4d.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/pipeline/lomo_frag_header.glsl

/* lomo:material/water.glsl */

// not the best way for doing this, should be replaced
float lomo_water_h(vec3 pos) {
	float t = frx_renderSeconds();
	pos.xy += t;
	return snoise(
		vec4(pos/8.0, t)
	) / 48.0;
}

void frx_materialFragment() {
	vec3 pos = frx_vertex.xyz / frx_vertex.w + frx_modelOriginWorldPos();

	float y_orig = lomo_water_h(pos);
	vec3 x_off = vec3(0.01, 0.0, 0.0);
	vec3 z_off = vec3(0.0, 0.0, 0.01);
	x_off.y += lomo_water_h(pos + x_off) - y_orig;
	z_off.y += lomo_water_h(pos + z_off) - y_orig;

	frag_normal = normalize(cross(z_off, x_off));

	frx_fragColor = frx_vertexColor*0.25 + vec4(0, 1, 1, 0)*0.75;
	//frx_fragReflectance = 1.;
	//frx_vertexColor.a = 0.4;

	reflectivity = 0.99;
}