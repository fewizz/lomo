#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/ray_sphere.glsl

/* lomo:lib/sky.glsl */

struct layer {
	vec3 pos;
	float bottom;
	float height;
};

vec2 ray_layer_intersection(ray r, layer l, bool to_space) {
	sphere top_sphere = sphere(l.pos, l.bottom + l.height);
	sphere bot_sphere = sphere(l.pos, l.bottom);
	
	ray_sphere_intersection_result top = ray_sphere_intersection(r, top_sphere);
	ray_sphere_intersection_result bot = ray_sphere_intersection(r, bot_sphere);

	if(bot.success) {
		if(bot.close < 0.0 && bot.far > 0.0) {
			return vec2(0.0, top.far);
		}
		if(bot.close > 0.0) {
			return vec2(max(top.close, 0.0), to_space ? top.far : bot.close);
		}
		if(top.far > 0.0){
			return vec2(max(bot.far, 0.0), top.far);
		}
	}
	else {
		return vec2(max(top.close, 0.0), top.far);
	}
	
	return vec2(0.0, 0.0);
}

float density_ratio(float h) {
	return exp(-h/0.06);
}

float density_ratio(vec3 point, layer l) {
	return density_ratio(distance(point, l.pos) - l.bottom);
}

float od_integration(vec3 po, vec3 dir, float dist, layer l) {	
	return density_ratio(po + dir * dist / 2.0, l) * dist;
}

vec3 resulting_attenuation(ray v, vec3 star_dir, layer l, vec3 coeffs) {
	vec2 atmo_range = ray_layer_intersection(v, l, false);
	float atmo_dist = (atmo_range[1] - atmo_range[0]);

	v.pos += v.dir * atmo_range[0];
	v.pos += v.dir * atmo_dist / 2.0;

	ray ray_to_star = ray(v.pos, star_dir);
	vec2 to_star_range = ray_layer_intersection(ray_to_star, l, true);

	return
		exp(
			-density_ratio(v.pos, l)
			-coeffs * (
				od_integration(v.pos, star_dir, to_star_range[1], l)
			)
		) *
		atmo_dist *
		coeffs;
}

vec3 sun_dir() {
	float t = frx_skyAngleRadians + 3.14 / 2.0;
	return vec3(cos(t), sin(t), 0);
}

vec3 sky_color(vec3 dir) {
	vec3 eye_pos = vec3(0, 6.0 + 0.03, 0.0) + frx_cameraPos / 1000000.0;

	ray eye = ray(eye_pos, dir);

	float a = dot(dir, sun_dir());
	vec3 rgb = pow(vec3(7.2, 5.7, 4.2), vec3(4.0));

	vec3 color = resulting_attenuation(eye, sun_dir(), layer(vec3(0.0), 6.0, 0.08), 25000.0/rgb);
	float sun = 0.0;
	float sun_a = 0.9999;
	float h = 0.0003;
	
	if(a > sun_a) {
		sun = 1.0;
	}
	else if(a > sun_a - h) {
		sun= (a - (sun_a - h)) / h;
	}
	sun*=15.0;
	color += color * sun;
	color *= vec3(1.2, 0.8, 1.5);

	return color;
}